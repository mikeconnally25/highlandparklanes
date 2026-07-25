import { StatusBadge } from "@/components/StatusBadge";
import { getSessionUser } from "@/lib/auth";
import { getMemberHistory } from "@/lib/coupons";
import { formatWeekLabel } from "@/lib/week";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "member") redirect("/login");

  const coupons = getMemberHistory(user.id);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/app" className="text-sm text-muted hover:text-cream">
        ← Back to this week
      </Link>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-5xl tracking-wide text-cream">
        Coupon history
      </h1>
      <p className="mt-2 text-muted">Past weekly coupons for your account.</p>

      <ul className="mt-8 divide-y divide-wood/40 border border-wood/40">
        {coupons.length === 0 && (
          <li className="px-4 py-6 text-muted">No coupons yet.</li>
        )}
        {coupons.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-4"
          >
            <div>
              <p className="font-mono text-cream">{c.code}</p>
              <p className="text-sm text-muted">
                {formatWeekLabel(c.weekStart)} · {c.games} games
              </p>
            </div>
            <StatusBadge status={c.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}
