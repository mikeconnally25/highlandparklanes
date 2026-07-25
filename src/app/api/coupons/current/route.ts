import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { ensureWeeklyCoupon } from "@/lib/coupons";
import { formatWeekLabel } from "@/lib/week";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser("member");
    const coupon = ensureWeeklyCoupon(user.id);
    return NextResponse.json({
      coupon,
      weekLabel: formatWeekLabel(coupon.weekStart),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to load coupon" }, { status: 500 });
  }
}
