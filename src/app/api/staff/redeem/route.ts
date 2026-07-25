import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { staffRedeem } from "@/lib/coupons";
import { formatWeekLabel } from "@/lib/week";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const staff = await requireUser("staff");
    const body = await request.json();
    const code = String(body.code || "").trim();
    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    const result = staffRedeem(code, staff.id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      coupon: {
        ...result.coupon,
        weekLabel: formatWeekLabel(result.coupon.weekStart),
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Redeem failed" }, { status: 500 });
  }
}
