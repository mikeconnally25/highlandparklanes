"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { BonusHuntState, BonusHuntStats, BonusItem, BonusTier } from "@/lib/bonus-hunt";
import {
  formatBetSize,
  formatBreakEvenLabel,
  formatMultiplier,
  getBonusMultiplier,
  getHuntStats,
  sortBonusesForDisplay,
} from "@/lib/bonus-hunt";
import { useHuntBoardState } from "@/components/HuntBoardContext";
import {
  HUNT_LIVE_EVENT,
  preferHuntBoard,
  readHuntCache,
  readHuntHashSeed,
  writeHuntCache,
} from "@/lib/hunt-client-sync";
import styles from "./BonusOverlayWidget.module.css";

const POLL_MS = 1500;

function tierLabel(tier: BonusTier): string {
  if (tier === "super") return "SUPER";
  if (tier === "epic") return "EPIC";
  return "";
}

function huntFingerprint(state: BonusHuntState): string {
  return [
    state.updatedAt,
    state.huntActive ? "1" : "0",
    state.title,
    String(state.startAmount ?? ""),
    state.bonuses
      .map(
        (bonus) =>
          `${bonus.id}:${bonus.name}:${bonus.betSize ?? ""}:${bonus.winAmount ?? ""}:${bonus.tier}:${bonus.requestedBy ?? ""}`,
      )
      .join("|"),
  ].join("::");
}

type BonusOverlayWidgetProps = {
  mode?: "obs" | "preview";
  limit?: number;
};

function BonusRows({
  bonuses,
  flashId,
  ariaHidden,
}: {
  bonuses: BonusItem[];
  flashId: string | null;
  ariaHidden?: boolean;
}) {
  return (
    <ul className={styles.list} aria-hidden={ariaHidden || undefined}>
      {bonuses.map((bonus, index) => (
        <li
          key={`${ariaHidden ? "dup-" : ""}${bonus.id}`}
          className={styles.row}
          data-tier={bonus.tier !== "normal" ? bonus.tier : undefined}
          data-flash={!ariaHidden && flashId === bonus.id ? true : undefined}
          data-enter={!ariaHidden && flashId === bonus.id ? true : undefined}
        >
          <span className={styles.index}>{index + 1}</span>
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
  );
}

export function BonusOverlayWidget({
  mode = "obs",
  limit,
}: BonusOverlayWidgetProps) {
  const effectiveLimit = limit ?? (mode === "obs" ? 100 : 12);
  const liveBoard = useHuntBoardState();
  const [board, setBoard] = useState<BonusHuntState | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);
  const fingerprintRef = useRef("");
  const boardRef = useRef<BonusHuntState | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);

  function applyBoard(next: BonusHuntState, opts?: { persist?: boolean }) {
    const merged = preferHuntBoard(boardRef.current, next);
    const fp = huntFingerprint(merged);
    if (fp === fingerprintRef.current && boardRef.current) return;

    const known = knownIdsRef.current;
    const sorted = sortBonusesForDisplay(merged.bonuses);
    if (!primedRef.current) {
      knownIdsRef.current = new Set(sorted.map((bonus) => bonus.id));
      primedRef.current = true;
    } else {
      const newest = [...sorted].reverse().find((bonus) => !known.has(bonus.id));
      if (newest) {
        setFlashId(newest.id);
        window.setTimeout(() => {
          setFlashId((current) => (current === newest.id ? null : current));
        }, 1200);
      }
      knownIdsRef.current = new Set(sorted.map((bonus) => bonus.id));
    }

    fingerprintRef.current = fp;
    boardRef.current = merged;
    setBoard(merged);
    // Preview never overwrites cache with polled empties
    if (opts?.persist && mode !== "preview") writeHuntCache(merged);
  }

  // Preview: mirror the Active Hunt panel via shared context (no API poll)
  useEffect(() => {
    if (mode !== "preview" || !liveBoard) return;
    applyBoard(liveBoard, { persist: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, liveBoard]);

  useEffect(() => {
    const seeded = readHuntHashSeed() ?? readHuntCache();
    if (!seeded) return;
    const frame = window.requestAnimationFrame(() => {
      applyBoard(seeded, { persist: false });
    });
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onLive(event: Event) {
      const detail = (event as CustomEvent<BonusHuntState>).detail;
      if (!detail) return;
      applyBoard(detail, { persist: false });
    }
    window.addEventListener(HUNT_LIVE_EVENT, onLive);
    return () => window.removeEventListener(HUNT_LIVE_EVENT, onLive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // OBS page only: poll API. Preview relies on context/events.
  useEffect(() => {
    if (mode === "preview") return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function load() {
      try {
        const res = await fetch("/api/bonus-hunt", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load");
        const data = (await res.json()) as BonusHuntState;
        if (cancelled) return;
        applyBoard(data, { persist: false });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveLimit, mode]);

  const bonuses = sortBonusesForDisplay(board?.bonuses ?? []).slice(
    0,
    effectiveLimit,
  );
  const title = board?.title ?? "";
  const stats: BonusHuntStats | null = board ? getHuntStats(board) : null;

  useEffect(() => {
    const viewport = viewportRef.current;
    const measure = measureRef.current;
    if (!viewport || !measure) {
      setShouldScroll(false);
      return;
    }

    function update() {
      if (!viewport || !measure) return;
      setShouldScroll(measure.scrollHeight > viewport.clientHeight + 8);
    }

    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [bonuses]);

  const durationSec = Math.max(14, bonuses.length * 2.4);

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
        <div
          ref={viewportRef}
          className={styles.listViewport}
          data-scrolling={shouldScroll || undefined}
        >
          <div
            className={styles.listTrack}
            data-scrolling={shouldScroll || undefined}
            style={
              shouldScroll
                ? ({ "--scroll-duration": `${durationSec}s` } as CSSProperties)
                : undefined
            }
          >
            <div ref={measureRef}>
              <BonusRows bonuses={bonuses} flashId={flashId} />
            </div>
            {shouldScroll ? (
              <BonusRows bonuses={bonuses} flashId={null} ariaHidden />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
