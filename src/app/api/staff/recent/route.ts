import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { staffRecent } from "@/lib/coupons";
import { formatWeekLabel } from "@/lib/week";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireUser("staff");
    const redemptions = staffRecent().map((c) => ({
      ...c,
      weekLabel: formatWeekLabel(c.weekStart),
    }));
    return NextResponse.json({ redemptions });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to load redemptions" }, { status: 500 });
  }
}
