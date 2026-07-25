import { CouponQR } from "@/components/CouponQR";
import { StatusBadge } from "@/components/StatusBadge";
import { getSessionUser } from "@/lib/auth";
import { couponPeriodInfo, ensureWeeklyCoupon } from "@/lib/coupons";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MemberHomePage() {
  const user = await getSessionUser();
  if (!user || user.role !== "member") redirect("/login");

  const coupon = ensureWeeklyCoupon(user.id);
  const { weekLabel, nextRefreshLabel, periodDays } = couponPeriodInfo(coupon);

  return (
    <div className="mx-auto max-w-lg">
      <p className="text-sm uppercase tracking-[0.2em] text-muted">This week</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-5xl tracking-wide text-cream md:text-6xl">
        Your free games
      </h1>
      <p className="mt-2 text-muted">Week of {weekLabel}</p>

      <div className="coupon-sheen mt-8 border border-amber/35 bg-gradient-to-br from-wood/40 to-lane-mid p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-[family-name:var(--font-display)] text-6xl leading-none text-amber-soft">
              3
            </p>
            <p className="mt-1 text-lg text-cream">free bowling games</p>
          </div>
          <StatusBadge status={coupon.status} />
        </div>

        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-8">
          <CouponQR code={coupon.code} />
          <div className="text-center sm:text-left">
            <p className="text-sm text-muted">Show this QR at the desk</p>
            <p className="mt-2 font-mono text-2xl tracking-widest text-cream">
              {coupon.code}
            </p>
            {coupon.status === "active" ? (
              <p className="mt-4 text-sm text-muted">
                Valid for {periodDays} days (through {weekLabel.split(" – ")[1]}
                ). A brand-new QR is generated every {periodDays} days — next
                refresh {nextRefreshLabel}.
              </p>
            ) : coupon.status === "redeemed" ? (
              <p className="mt-4 text-sm text-amber-soft">
                Redeemed
                {coupon.redeemedAt
                  ? ` on ${new Date(coupon.redeemedAt).toLocaleString()}`
                  : ""}
                . Your next QR arrives {nextRefreshLabel}.
              </p>
            ) : (
              <p className="mt-4 text-sm text-muted">
                This QR expired after {periodDays} days. Refresh the page for
                your new code.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
