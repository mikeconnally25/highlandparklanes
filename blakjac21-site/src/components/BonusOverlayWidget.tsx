"use client";

import { useEffect, useRef, useState } from "react";
import type { BonusHuntState, BonusItem, BonusTier } from "@/lib/bonus-hunt";
import { formatBetSize } from "@/lib/bonus-hunt";
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
                <span className={styles.name}>{bonus.name}</span>
                <span className={styles.meta}>
                  <span className={styles.bet}>{formatBetSize(bonus.betSize)}</span>
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
