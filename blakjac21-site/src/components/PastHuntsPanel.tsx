"use client";

import { useEffect, useState } from "react";
import type { PastHuntResult } from "@/lib/bonus-hunt";
import {
  formatBetSize,
  formatBreakEvenLabel,
  formatMultiplier,
  getBonusMultiplier,
  sortBonusesForDisplay,
} from "@/lib/bonus-hunt";
import styles from "./PastHuntsPanel.module.css";

function formatWhen(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function profitLabel(hunt: PastHuntResult): string {
  if (hunt.stats.startAmount == null) return "—";
  const profit = hunt.stats.totalWins - hunt.stats.startAmount;
  const sign = profit > 0 ? "+" : "";
  return `${sign}${formatBetSize(profit)}`;
}

export function PastHuntsPanel() {
  const [hunts, setHunts] = useState<PastHuntResult[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/bonus-hunt/history", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { hunts?: PastHuntResult[] };
        if (!cancelled) setHunts(data.hunts ?? []);
      } catch {
        /* ignore */
      }
    }

    load();
    const timer = setInterval(load, 5000);
    const onHistory = () => {
      void load();
    };
    window.addEventListener("bonus-hunt-history-changed", onHistory);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("bonus-hunt-history-changed", onHistory);
    };
  }, []);

  if (hunts.length === 0) {
    return (
      <p className={styles.empty}>
        Ended hunts show up here. Use <strong>End hunt</strong> in streamer
        controls to archive the active board.
      </p>
    );
  }

  return (
    <ul className={styles.list}>
      {hunts.map((hunt) => {
        const open = openId === hunt.id;
        return (
          <li key={hunt.id} className={styles.item}>
            <button
              type="button"
              className={styles.itemToggle}
              aria-expanded={open}
              onClick={() =>
                setOpenId((current) => (current === hunt.id ? null : hunt.id))
              }
            >
              <span className={styles.itemTitle}>{hunt.title}</span>
              <span className={styles.itemMeta}>
                {hunt.bonuses.length} bonus
                {hunt.bonuses.length === 1 ? "" : "es"} · {profitLabel(hunt)} ·{" "}
                {formatWhen(hunt.endedAt)}
              </span>
              <span
                className={styles.chevron}
                data-open={open || undefined}
                aria-hidden
              />
            </button>

            {open ? (
              <div className={styles.detail}>
                <div className={styles.stats}>
                  <div>
                    <p className={styles.statLabel}>Started with</p>
                    <p className={styles.statValue}>
                      {formatBetSize(hunt.startAmount)}
                    </p>
                  </div>
                  <div>
                    <p className={styles.statLabel}>Total wins</p>
                    <p className={styles.statValue}>
                      {formatBetSize(hunt.stats.totalWins)}
                    </p>
                  </div>
                  <div>
                    <p className={styles.statLabel}>P/L</p>
                    <p className={styles.statValue}>{profitLabel(hunt)}</p>
                  </div>
                  <div>
                    <p className={styles.statLabel}>Avg x opened</p>
                    <p className={styles.statValue}>
                      {formatMultiplier(hunt.stats.avgXOpened)}
                    </p>
                  </div>
                  <div>
                    <p className={styles.statLabel}>Break-even</p>
                    <p className={styles.statValue}>
                      {formatBreakEvenLabel(hunt.stats)}
                    </p>
                  </div>
                </div>

                <p className={styles.when}>
                  {hunt.startedAt
                    ? `Started ${formatWhen(hunt.startedAt)} · `
                    : ""}
                  Ended {formatWhen(hunt.endedAt)}
                </p>

                {hunt.bonuses.length === 0 ? (
                  <p className={styles.empty}>No bonuses recorded.</p>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th scope="col">#</th>
                          <th scope="col">Bonus</th>
                          <th scope="col">Bet</th>
                          <th scope="col">Win</th>
                          <th scope="col">X</th>
                          <th scope="col">Tier</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hunt.bonuses.map((bonus, index) => (
                          <tr key={bonus.id}>
                            <td>{index + 1}</td>
                            <td>
                              <span className={styles.bonusName}>
                                {bonus.name}
                              </span>
                              {bonus.requestedBy ? (
                                <span className={styles.requester}>
                                  {bonus.requestedBy}
                                </span>
                              ) : null}
                            </td>
                            <td>{formatBetSize(bonus.betSize)}</td>
                            <td>{formatBetSize(bonus.winAmount)}</td>
                            <td>
                              {formatMultiplier(getBonusMultiplier(bonus))}
                            </td>
                            <td className={styles.tier}>{bonus.tier}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
