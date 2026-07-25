import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { getMemberHistory } from "@/lib/coupons";
import { formatWeekLabel } from "@/lib/week";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser("member");
    const coupons = getMemberHistory(user.id).map((c) => ({
      ...c,
      weekLabel: formatWeekLabel(c.weekStart),
    }));
    return NextResponse.json({ coupons });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to load history" }, { status: 500 });
  }
}
