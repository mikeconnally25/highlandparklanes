import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { staffLookup, staffLookupByCode } from "@/lib/coupons";
import { formatWeekLabel } from "@/lib/week";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireUser("staff");
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const code = searchParams.get("code")?.trim() || "";

    if (code) {
      const coupon = staffLookupByCode(code);
      return NextResponse.json({
        results: coupon
          ? [{ ...coupon, weekLabel: formatWeekLabel(coupon.weekStart) }]
          : [],
      });
    }

    const results = staffLookup(q).map((c) => ({
      ...c,
      weekLabel: formatWeekLabel(c.weekStart),
    }));
    return NextResponse.json({ results });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}
