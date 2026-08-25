"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { BonusHuntState, BonusHuntStats } from "@/lib/bonus-hunt";
import {
  formatBetSize,
  formatBreakEvenLabel,
  formatMultiplier,
  getHuntStats,
} from "@/lib/bonus-hunt";
import styles from "./HomeHuntStats.module.css";

const POLL_MS = 2500;

type HuntSnapshot = {
  title: string;
  huntActive: boolean;
  bonusCount: number;
  stats: BonusHuntStats;
};

export function HomeHuntStats() {
  const [hunt, setHunt] = useState<HuntSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function load() {
      try {
        const res = await fetch("/api/bonus-hunt", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load");
        const data = (await res.json()) as BonusHuntState;
        if (cancelled) return;
        setHunt({
          title: data.title,
          huntActive: data.huntActive,
          bonusCount: data.bonuses.length,
          stats: getHuntStats(data),
        });
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) timer = setTimeout(load, POLL_MS);
      }
    }

    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const stats = hunt?.stats;
  const hasHunt =
    Boolean(hunt) &&
    (hunt!.huntActive ||
      hunt!.bonusCount > 0 ||
      hunt!.stats.startAmount != null);

  return (
    <section className={styles.section} aria-labelledby="home-hunt-stats">
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Bonus hunt</p>
        <h2 id="home-hunt-stats" className={styles.title}>
          Hunt totals
        </h2>
        <p className={styles.lead}>
          {hasHunt
            ? hunt!.title || "Live hunt stats from the current bonus board."
            : "Totals appear here when a bonus hunt is running."}
        </p>
      </div>

      {hasHunt && stats ? (
        <div className={styles.grid} role="list">
          <div className={styles.stat} role="listitem">
            <span className={styles.label}>Start</span>
            <span className={styles.value}>
              {formatBetSize(stats.startAmount)}
            </span>
          </div>
          <div className={styles.stat} role="listitem">
            <span className={styles.label}>Total bet</span>
            <span className={styles.value}>
              {formatBetSize(stats.totalBet > 0 ? stats.totalBet : null)}
            </span>
          </div>
          <div className={styles.stat} role="listitem">
            <span className={styles.label}>Total wins</span>
            <span className={styles.value}>
              {formatBetSize(stats.totalWins > 0 ? stats.totalWins : null)}
            </span>
          </div>
          <div className={styles.stat} role="listitem">
            <span className={styles.label}>Bonuses</span>
            <span className={styles.value}>
              {hunt!.bonusCount}
              <span className={styles.valueHint}>
                {stats.openedCount} opened
              </span>
            </span>
          </div>
          <div className={styles.stat} role="listitem">
            <span className={styles.label}>Avg x</span>
            <span className={styles.value}>
              {formatMultiplier(stats.avgXOpened)}
            </span>
          </div>
          <div className={styles.stat} role="listitem">
            <span className={styles.label}>BE x</span>
            <span className={styles.value}>
              {formatBreakEvenLabel(stats)}
            </span>
          </div>
        </div>
      ) : (
        <p className={styles.empty}>No active hunt stats yet.</p>
      )}

      <Link className={styles.link} href="/bonus-hunts">
        Open bonus hunts →
      </Link>
    </section>
  );
}
