export const ALLEY_TZ =
  process.env.ALLEY_TIMEZONE || "America/New_York";

/** Coupon / QR rotation length in days. */
export const COUPON_PERIOD_DAYS = 7;

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function getZonedParts(date: Date, timeZone = ALLEY_TZ) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    weekday: map.weekday as string,
  };
}

function toISODate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseISODate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** Monday (YYYY-MM-DD) of the current alley-local week — start of the 7-day QR period. */
export function getWeekStartISO(date = new Date(), timeZone = ALLEY_TZ): string {
  const { year, month, day, weekday } = getZonedParts(date, timeZone);
  const utcNoon = new Date(Date.UTC(year, month - 1, day, 12));
  const dow = WEEKDAY_TO_INDEX[weekday] ?? 0;
  const daysFromMonday = (dow + 6) % 7;
  utcNoon.setUTCDate(utcNoon.getUTCDate() - daysFromMonday);
  return toISODate(
    utcNoon.getUTCFullYear(),
    utcNoon.getUTCMonth() + 1,
    utcNoon.getUTCDate(),
  );
}

/** Last day of the 7-day period (Sunday), YYYY-MM-DD. */
export function getWeekEndISO(weekStart: string): string {
  const end = parseISODate(weekStart);
  end.setUTCDate(end.getUTCDate() + (COUPON_PERIOD_DAYS - 1));
  return toISODate(
    end.getUTCFullYear(),
    end.getUTCMonth() + 1,
    end.getUTCDate(),
  );
}

/** Next Monday — when a brand-new QR/code is issued. */
export function getNextRefreshISO(weekStart: string): string {
  const next = parseISODate(weekStart);
  next.setUTCDate(next.getUTCDate() + COUPON_PERIOD_DAYS);
  return toISODate(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
  );
}

export function formatWeekLabel(weekStart: string): string {
  const start = parseISODate(weekStart);
  const end = parseISODate(getWeekEndISO(weekStart));

  const fmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

export function formatRefreshDate(weekStart: string): string {
  const next = parseISODate(getNextRefreshISO(weekStart));
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(next);
}
