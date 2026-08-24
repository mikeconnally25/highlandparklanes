"use client";

import { useEffect, useRef, useState } from "react";
import type { BonusHuntState, BonusHuntStats, BonusItem, BonusTier } from "@/lib/bonus-hunt";
import {
  formatBetSize,
  formatBreakEvenLabel,
  formatMultiplier,
  getBonusMultiplier,
  getHuntStats,
} from "@/lib/bonus-hunt";
import styles from "./BonusOverlayWidget.module.css";

const POLL_MS = 1500;

function tierLabel(tier: BonusTier): string {
  if (tier === "super") return "SUPER";
  if (tier === "epic") return "EPIC";
  return "";
}

type BonusOverlayWidgetProps = {
  mode?: "obs" | "preview";
  limit?: number;
};

export function BonusOverlayWidget({
  mode = "obs",
  limit = 12,
}: BonusOverlayWidgetProps) {
  const [bonuses, setBonuses] = useState<BonusItem[]>([]);
  const [title, setTitle] = useState("");
  const [stats, setStats] = useState<BonusHuntStats | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function load() {
      try {
        const res = await fetch("/api/bonus-hunt", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load");
        const data = (await res.json()) as BonusHuntState;
        if (cancelled) return;

        const next = [...data.bonuses].reverse().slice(0, limit);
        const known = knownIdsRef.current;

        if (!primedRef.current) {
          knownIdsRef.current = new Set(next.map((bonus) => bonus.id));
          primedRef.current = true;
        } else {
          const newest = next.find((bonus) => !known.has(bonus.id));
          if (newest) {
            setFlashId(newest.id);
            window.setTimeout(() => {
              if (!cancelled) setFlashId((current) =>
                current === newest.id ? null : current,
              );
            }, 1200);
          }
          knownIdsRef.current = new Set(next.map((bonus) => bonus.id));
        }

        setBonuses(next);
        setTitle(data.title);
        setStats(getHuntStats(data));
      } catch {
        /* ignore transient errors */
      } finally {
        if (!cancelled) timer = setTimeout(load, POLL_MS);
      }
    }

    load();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [limit]);

  return (
    <div
      className={`${styles.widget} ${mode === "preview" ? styles.preview : styles.obs}`}
      aria-live="polite"
      aria-label="Bonus hunt overlay"
    >
      <div className={styles.header}>
        <p className={styles.kicker}>Bonus list</p>
        <h2 className={styles.title}>{title || "Active hunt"}</h2>
        {stats?.startAmount != null ? (
          <p className={styles.startAmount}>
            Started with {formatBetSize(stats.startAmount)}
          </p>
        ) : null}
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Avg x</span>
          <span className={styles.statValue}>
            {formatMultiplier(stats?.avgXOpened ?? null)}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>BE x</span>
          <span className={styles.statValue}>
            {stats ? formatBreakEvenLabel(stats) : "—"}
          </span>
        </div>
      </div>

      {bonuses.length === 0 ? (
        <p className={styles.empty}>Waiting for bonuses…</p>
      ) : (
        <ul className={styles.list}>
          {bonuses.map((bonus, index) => (
            <li
              key={bonus.id}
              className={styles.row}
              data-tier={bonus.tier !== "normal" ? bonus.tier : undefined}
              data-flash={flashId === bonus.id || undefined}
              style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
            >
              <span className={styles.index}>{bonuses.length - index}</span>
              <div className={styles.main}>
                <span className={styles.name}>
                  {bonus.name}
                  {bonus.requestedBy ? (
                    <span className={styles.requester}> {bonus.requestedBy}</span>
                  ) : null}
                </span>
                <span className={styles.meta}>
                  <span className={styles.bet}>
                    Bet {formatBetSize(bonus.betSize)}
                  </span>
                  <span className={styles.win}>
                    Win {formatBetSize(bonus.winAmount)}
                  </span>
                  {bonus.winAmount != null && bonus.betSize != null ? (
                    <span className={styles.hitX}>
                      {formatMultiplier(getBonusMultiplier(bonus))}
                    </span>
                  ) : null}
                  {bonus.tier !== "normal" ? (
                    <span className={styles.tier} data-tier={bonus.tier}>
                      {tierLabel(bonus.tier)}
                    </span>
                  ) : null}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
