import { randomBytes } from "node:crypto";
import {
  expireStaleCoupons,
  getCouponByCode,
  getCouponByUserAndWeek,
  getCouponWithMember,
  insertCoupon,
  listCouponsForUser,
  lookupCoupons,
  recentRedemptions,
  redeemCoupon,
  searchWeekStatusByName,
} from "./db";
import {
  COUPON_PERIOD_DAYS,
  formatRefreshDate,
  formatWeekLabel,
  getWeekStartISO,
} from "./week";
import type { Coupon, CouponWithMember, WeekStatusRow } from "./types";

/** Cryptographically random coupon code — becomes a new QR every period. */
function generateCode(): string {
  const raw = randomBytes(5).toString("hex").toUpperCase();
  return `SC-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

function mintUniqueCode(): string {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = generateCode();
    if (!getCouponByCode(code)) return code;
  }
  throw new Error("Could not generate a unique coupon code");
}

/**
 * Ensure the member has a coupon for the current 7-day period.
 * Each new period always gets a brand-new code (and therefore a new QR).
 */
export function ensureWeeklyCoupon(userId: number): Coupon {
  const weekStart = getWeekStartISO();
  expireStaleCoupons(weekStart);

  const existing = getCouponByUserAndWeek(userId, weekStart);
  if (existing) return existing;

  const code = mintUniqueCode();
  return insertCoupon({ userId, code, weekStart, games: 3 });
}

export function getMemberHistory(userId: number): Coupon[] {
  const weekStart = getWeekStartISO();
  expireStaleCoupons(weekStart);
  return listCouponsForUser(userId);
}

export function staffLookup(query: string): CouponWithMember[] {
  expireStaleCoupons(getWeekStartISO());
  return lookupCoupons(query);
}

export function staffLookupByCode(code: string): CouponWithMember | null {
  expireStaleCoupons(getWeekStartISO());
  return getCouponWithMember(code);
}

export function staffRedeem(
  code: string,
  staffId: number,
): { ok: true; coupon: CouponWithMember } | { ok: false; error: string } {
  expireStaleCoupons(getWeekStartISO());

  const found = getCouponWithMember(code);
  if (!found) {
    return { ok: false, error: "No coupon found for that code" };
  }
  if (found.status === "redeemed") {
    return {
      ok: false,
      error: `Already redeemed${found.redeemedAt ? ` on ${new Date(found.redeemedAt).toLocaleString()}` : ""}`,
    };
  }
  if (found.status === "expired") {
    return {
      ok: false,
      error: `This QR expired after ${COUPON_PERIOD_DAYS} days — ask the member to open their app for a new code`,
    };
  }

  // Refuse codes from a previous 7-day period even if somehow still "active"
  if (found.weekStart !== getWeekStartISO()) {
    return {
      ok: false,
      error: "This QR is from a previous week — member needs the new 7-day code",
    };
  }

  const updated = redeemCoupon(found.id, staffId);
  if (!updated) {
    return { ok: false, error: "Could not redeem — coupon may already be used" };
  }

  const withMember = getCouponWithMember(updated.code);
  if (!withMember) {
    return { ok: false, error: "Redeemed, but failed to reload coupon" };
  }

  return { ok: true, coupon: withMember };
}

export function staffRecent() {
  return recentRedemptions(20);
}

export function staffWeekStatusByName(name: string): {
  weekStart: string;
  results: WeekStatusRow[];
} {
  const weekStart = getWeekStartISO();
  expireStaleCoupons(weekStart);
  return {
    weekStart,
    results: searchWeekStatusByName(name, weekStart),
  };
}

export function couponPeriodInfo(coupon: Coupon) {
  return {
    weekLabel: formatWeekLabel(coupon.weekStart),
    nextRefreshLabel: formatRefreshDate(coupon.weekStart),
    periodDays: COUPON_PERIOD_DAYS,
  };
}
