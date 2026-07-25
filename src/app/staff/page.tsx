"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";

type CouponResult = {
  id: number;
  code: string;
  weekStart: string;
  weekLabel: string;
  games: number;
  status: string;
  memberName: string;
  memberEmail: string;
  redeemedAt: string | null;
  redeemedByName: string | null;
};

type WeekStatusRow = {
  memberId: number;
  memberName: string;
  memberEmail: string;
  weekStart: string;
  weekLabel: string;
  redeemedThisWeek: boolean;
  coupon: CouponResult | null;
};

export default function StaffDashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CouponResult[]>([]);
  const [selected, setSelected] = useState<CouponResult | null>(null);
  const [recent, setRecent] = useState<CouponResult[]>([]);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const [nameQuery, setNameQuery] = useState("");
  const [nameBusy, setNameBusy] = useState(false);
  const [nameError, setNameError] = useState("");
  const [weekLabel, setWeekLabel] = useState("");
  const [weekRows, setWeekRows] = useState<WeekStatusRow[]>([]);

  const loadRecent = useCallback(async () => {
    const res = await fetch("/api/staff/recent");
    if (res.status === 401 || res.status === 403) {
      router.replace("/staff/login");
      return;
    }
    const data = await res.json();
    setRecent(data.redemptions || []);
  }, [router]);

  useEffect(() => {
    (async () => {
      const me = await fetch("/api/auth/me");
      if (!me.ok) {
        router.replace("/staff/login");
        return;
      }
      const data = await me.json();
      if (data.user?.role !== "staff") {
        router.replace("/staff/login");
        return;
      }
      setReady(true);
      await loadRecent();
    })();
  }, [router, loadRecent]);

  async function onLookup(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setBusy(true);
    const q = query.trim();
    const looksLikeCode = /^SC-/i.test(q) || q.includes("-");

    const url = looksLikeCode
      ? `/api/staff/lookup?code=${encodeURIComponent(q)}`
      : `/api/staff/lookup?q=${encodeURIComponent(q)}`;

    const res = await fetch(url);
    const data = await res.json();
    setBusy(false);

    if (!res.ok) {
      setMessage({ type: "err", text: data.error || "Lookup failed" });
      return;
    }

    const list = (data.results || []) as CouponResult[];
    setResults(list);
    setSelected(list[0] || null);
    if (list.length === 0) {
      setMessage({ type: "err", text: "No matching coupons found" });
    }
  }

  async function onNameSearch(e: FormEvent) {
    e.preventDefault();
    setNameError("");
    setNameBusy(true);
    const res = await fetch(
      `/api/staff/week-status?name=${encodeURIComponent(nameQuery.trim())}`,
    );
    const data = await res.json();
    setNameBusy(false);

    if (!res.ok) {
      setWeekRows([]);
      setNameError(data.error || "Search failed");
      return;
    }

    setWeekLabel(data.weekLabel || "");
    setWeekRows((data.results || []) as WeekStatusRow[]);
    if (!data.results?.length) {
      setNameError("No members found with that name");
    }
  }

  async function onRedeem() {
    if (!selected) return;
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/staff/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: selected.code }),
    });
    const data = await res.json();
    setBusy(false);

    if (!res.ok) {
      setMessage({ type: "err", text: data.error || "Redeem failed" });
      return;
    }

    const updated = data.coupon as CouponResult;
    setSelected(updated);
    setResults((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setWeekRows((prev) =>
      prev.map((row) =>
        row.coupon?.id === updated.id
          ? {
              ...row,
              redeemedThisWeek: true,
              coupon: updated,
            }
          : row,
      ),
    );
    setMessage({
      type: "ok",
      text: `Redeemed ${updated.code} for ${updated.memberName} — ${updated.games} free games.`,
    });
    await loadRecent();
  }

  function openCouponFromName(row: WeekStatusRow) {
    if (!row.coupon) return;
    setSelected(row.coupon);
    setResults([row.coupon]);
    setQuery(row.coupon.code);
    setMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!ready) {
    return (
      <div className="px-6 py-16 text-center text-[#888]">Loading dashboard…</div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section>
          <h2 className="text-xl font-semibold">Validate & redeem</h2>
          <p className="mt-1 text-sm text-[#aaa]">
            Enter a coupon code or email. Scanner keyboards work in the code
            field.
          </p>

          <form onSubmit={onLookup} className="mt-5 flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="SC-XXXX-XXXX or email"
              autoFocus
              className="flex-1 border border-[#333] bg-[#1a1a1a] px-3 py-3 font-mono outline-none focus:border-[#e8a317]"
            />
            <button
              type="submit"
              disabled={busy || !query.trim()}
              className="bg-[#e8a317] px-5 font-semibold text-[#1a1008] disabled:opacity-50"
            >
              Look up
            </button>
          </form>

          {message && (
            <p
              className={`mt-4 text-sm ${message.type === "ok" ? "text-[#3d8b5e]" : "text-[#c45c3a]"}`}
            >
              {message.text}
            </p>
          )}

          {selected && (
            <div className="mt-6 border border-[#333] bg-[#1a1a1a] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-2xl tracking-wider">
                    {selected.code}
                  </p>
                  <p className="mt-2 text-lg">{selected.memberName}</p>
                  <p className="text-sm text-[#aaa]">{selected.memberEmail}</p>
                  <p className="mt-2 text-sm text-[#aaa]">
                    {selected.games} games · {selected.weekLabel}
                  </p>
                </div>
                <StatusBadge status={selected.status} />
              </div>

              {selected.status === "redeemed" && (
                <p className="mt-4 text-sm text-[#aaa]">
                  Redeemed
                  {selected.redeemedAt
                    ? ` ${new Date(selected.redeemedAt).toLocaleString()}`
                    : ""}
                  {selected.redeemedByName
                    ? ` by ${selected.redeemedByName}`
                    : ""}
                </p>
              )}

              <button
                type="button"
                onClick={onRedeem}
                disabled={busy || selected.status !== "active"}
                className="mt-5 w-full bg-[#3d8b5e] py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#2a2a2a] disabled:text-[#666]"
              >
                {selected.status === "active"
                  ? `Redeem ${selected.games} free games`
                  : "Cannot redeem"}
              </button>
            </div>
          )}

          {results.length > 1 && (
            <ul className="mt-4 divide-y divide-[#2a2a2a] border border-[#2a2a2a]">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(r);
                      setMessage(null);
                    }}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#1a1a1a] ${
                      selected?.id === r.id ? "bg-[#1a1a1a]" : ""
                    }`}
                  >
                    <span>
                      <span className="font-mono">{r.code}</span>
                      <span className="ml-3 text-sm text-[#aaa]">
                        {r.memberName}
                      </span>
                    </span>
                    <StatusBadge status={r.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-xl font-semibold">Recent redemptions</h2>
          <p className="mt-1 text-sm text-[#aaa]">Latest activity this shift.</p>
          <ul className="mt-5 divide-y divide-[#2a2a2a] border border-[#2a2a2a]">
            {recent.length === 0 && (
              <li className="px-4 py-6 text-sm text-[#888]">
                No redemptions yet.
              </li>
            )}
            {recent.map((r) => (
              <li key={r.id} className="px-4 py-3">
                <div className="flex justify-between gap-2">
                  <span className="font-mono text-sm">{r.code}</span>
                  <span className="text-xs text-[#888]">
                    {r.redeemedAt
                      ? new Date(r.redeemedAt).toLocaleTimeString()
                      : ""}
                  </span>
                </div>
                <p className="text-sm">
                  {r.memberName}{" "}
                  <span className="text-[#888]">· {r.games} games</span>
                </p>
                {r.redeemedByName && (
                  <p className="text-xs text-[#888]">by {r.redeemedByName}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="border border-[#2a2a2a] bg-[#161616] p-6">
        <h2 className="text-xl font-semibold">Search by name — this week</h2>
        <p className="mt-1 text-sm text-[#aaa]">
          Check whether a member already redeemed their free games for the
          current week
          {weekLabel ? ` (${weekLabel})` : ""}.
        </p>

        <form onSubmit={onNameSearch} className="mt-5 flex flex-wrap gap-2">
          <input
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
            placeholder="Member name (e.g. Mike)"
            className="min-w-[16rem] flex-1 border border-[#333] bg-[#1a1a1a] px-3 py-3 outline-none focus:border-[#e8a317]"
          />
          <button
            type="submit"
            disabled={nameBusy || nameQuery.trim().length < 2}
            className="bg-[#e8a317] px-5 font-semibold text-[#1a1008] disabled:opacity-50"
          >
            {nameBusy ? "Searching…" : "Check week"}
          </button>
        </form>

        {nameError && (
          <p className="mt-4 text-sm text-[#c45c3a]">{nameError}</p>
        )}

        {weekRows.length > 0 && (
          <ul className="mt-5 divide-y divide-[#2a2a2a] border border-[#2a2a2a]">
            {weekRows.map((row) => (
              <li
                key={row.memberId}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-4"
              >
                <div>
                  <p className="text-base font-medium">{row.memberName}</p>
                  <p className="text-sm text-[#aaa]">{row.memberEmail}</p>
                  {row.coupon ? (
                    <p className="mt-1 font-mono text-sm text-[#ccc]">
                      {row.coupon.code}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-[#888]">
                      No coupon issued yet this week
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {row.redeemedThisWeek ? (
                    <span className="inline-flex items-center rounded border border-[#e8a317]/40 bg-[#e8a317]/15 px-2.5 py-1 text-xs uppercase tracking-wider text-[#f0c14b]">
                      Redeemed this week
                    </span>
                  ) : row.coupon?.status === "active" ? (
                    <span className="inline-flex items-center rounded border border-[#3d8b5e]/40 bg-[#3d8b5e]/20 px-2.5 py-1 text-xs uppercase tracking-wider text-[#3d8b5e]">
                      Not redeemed yet
                    </span>
                  ) : row.coupon ? (
                    <StatusBadge status={row.coupon.status} />
                  ) : (
                    <span className="inline-flex items-center rounded border border-[#666]/40 px-2.5 py-1 text-xs uppercase tracking-wider text-[#888]">
                      No coupon
                    </span>
                  )}
                  {row.coupon && (
                    <button
                      type="button"
                      onClick={() => openCouponFromName(row)}
                      className="text-sm text-[#e8a317] hover:underline"
                    >
                      Open to redeem
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
