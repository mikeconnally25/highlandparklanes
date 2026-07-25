import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { staffWeekStatusByName } from "@/lib/coupons";
import { formatWeekLabel } from "@/lib/week";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireUser("staff");
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name")?.trim() || "";

    if (name.length < 2) {
      return NextResponse.json(
        { error: "Enter at least 2 characters of a name" },
        { status: 400 },
      );
    }

    const { weekStart, results } = staffWeekStatusByName(name);
    return NextResponse.json({
      weekStart,
      weekLabel: formatWeekLabel(weekStart),
      results: results.map((r) => ({
        ...r,
        weekLabel: formatWeekLabel(weekStart),
        coupon: r.coupon
          ? { ...r.coupon, weekLabel: formatWeekLabel(r.coupon.weekStart) }
          : null,
      })),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
