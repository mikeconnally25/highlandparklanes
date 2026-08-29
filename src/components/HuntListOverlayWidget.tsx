"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { BonusHuntState, BonusItem } from "@/lib/bonus-hunt";
import {
  formatBetSize,
  formatBreakEvenLabel,
  getHuntStats,
  sortBonusesForDisplay,
} from "@/lib/bonus-hunt";
import { useHuntBoardState } from "@/components/HuntBoardContext";
import {
  clearOverlayHash,
  HUNT_LIVE_EVENT,
  isIntentionalReset,
  preferHuntBoard,
  readHuntCache,
  readHuntHashSeed,
  resolveOverlayBoard,
  writeHuntCache,
} from "@/lib/hunt-client-sync";
import { SlotThumbnail } from "@/components/SlotThumbnail";
import {
  huntOverlayFingerprint,
  OVERLAY_FAST_POLL_WINDOW_MS,
  overlayPollIntervalMs,
} from "@/lib/overlay-hunt-board";
import styles from "./HuntListOverlayWidget.module.css";

function huntTitleLabel(title: string): string {
  const trimmed = title.trim();
  return trimmed || "Hunt list";
}

function HuntListRows({
  bonuses,
  breakEvenLabel,
  ariaHidden,
}: {
  bonuses: BonusItem[];
  breakEvenLabel: string;
  ariaHidden?: boolean;
}) {
  return (
    <div className={styles.tableBody} aria-hidden={ariaHidden || undefined}>
      {bonuses.map((bonus, index) => (
        <div
          key={`${ariaHidden ? "dup-" : ""}${bonus.id}`}
          className={styles.tableRow}
          data-tier={bonus.tier !== "normal" ? bonus.tier : undefined}
        >
          <span className={styles.colHunt}>{index + 1}</span>
          <span className={styles.colBreakEven}>{breakEvenLabel}</span>
          <span className={styles.colName} title={bonus.name}>
            <SlotThumbnail
              name={bonus.name}
              thumbnailUrl={bonus.thumbnailUrl}
            />
            <span className={styles.nameStack}>
              <span className={styles.bonusName}>{bonus.name}</span>
              {bonus.requestedBy ? (
                <span className={styles.requester}>@{bonus.requestedBy}</span>
              ) : null}
            </span>
          </span>
          <span className={styles.colBet}>{formatBetSize(bonus.betSize)}</span>
          <span className={styles.colWin}>{formatBetSize(bonus.winAmount)}</span>
        </div>
      ))}
    </div>
  );
}

type HuntListOverlayWidgetProps = {
  mode?: "obs" | "preview";
  limit?: number;
  boardSeed?: BonusHuntState | null;
};

export function HuntListOverlayWidget({
  mode = "obs",
  limit,
  boardSeed = null,
}: HuntListOverlayWidgetProps) {
  const effectiveLimit = limit ?? (mode === "obs" ? 100 : 24);
  const liveBoard = useHuntBoardState();
  const [board, setBoard] = useState<BonusHuntState | null>(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const fingerprintRef = useRef("");
  const boardRef = useRef<BonusHuntState | null>(null);
  const fastPollUntilRef = useRef(0);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);

  function applyBoard(next: BonusHuntState, opts?: { persist?: boolean }) {
    const merged =
      mode === "obs"
        ? resolveOverlayBoard(boardRef.current, next)
        : preferHuntBoard(boardRef.current, next);
    const fp = huntOverlayFingerprint(merged);
    const epochChanged =
      (merged.boardEpoch ?? 0) !== (boardRef.current?.boardEpoch ?? 0);
    if (!epochChanged && fp === fingerprintRef.current && boardRef.current) {
      return;
    }

    if (isIntentionalReset(merged)) {
      clearOverlayHash();
    }
    if (epochChanged || isIntentionalReset(merged)) {
      fastPollUntilRef.current = Date.now() + OVERLAY_FAST_POLL_WINDOW_MS;
    }

    fingerprintRef.current = fp;
    boardRef.current = merged;
    setBoard(merged);
    if (mode === "obs" || opts?.persist) writeHuntCache(merged);
  }

  useEffect(() => {
    if (mode !== "preview" || !liveBoard) return;
    applyBoard(liveBoard, { persist: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, liveBoard]);

  useEffect(() => {
    if (mode !== "preview" || !boardSeed) return;
    applyBoard(boardSeed, { persist: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, boardSeed]);

  useEffect(() => {
    const seeded = readHuntHashSeed() ?? readHuntCache();
    if (!seeded) return;
    const frame = window.requestAnimationFrame(() => {
      applyBoard(seeded, { persist: false });
    });
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

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

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function load() {
      try {
        const res = await fetch("/api/bonus-hunt", {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache, no-store" },
        });
        if (!res.ok) throw new Error("Failed to load");
        const data = (await res.json()) as BonusHuntState;
        if (cancelled) return;
        applyBoard(data, { persist: false });
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) {
          timer = setTimeout(
            load,
            overlayPollIntervalMs(mode, fastPollUntilRef.current),
          );
        }
      }
    }

    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveLimit, mode]);

  const bonuses = useMemo(
    () => sortBonusesForDisplay(board?.bonuses ?? []).slice(0, effectiveLimit),
    [board, effectiveLimit],
  );
  const stats = board ? getHuntStats(board) : null;
  const breakEvenLabel = stats ? formatBreakEvenLabel(stats) : "—";
  const title = huntTitleLabel(board?.title ?? "");
  const readyForNextHunt = Boolean(board && isIntentionalReset(board));

  useEffect(() => {
    const viewport = viewportRef.current;
    const measure = measureRef.current;
    if (!viewport || !measure) {
      setShouldScroll(false);
      return;
    }

    function update() {
      if (!viewport || !measure) return;
      setShouldScroll(measure.scrollHeight > viewport.clientHeight + 4);
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
      aria-label="Hunt list overlay"
    >
      <div className={styles.card}>
        <header className={styles.topBar}>
          <h2 className={styles.brand}>Hunt list</h2>
          <p className={styles.huntTitle}>{title}</p>
        </header>

        <div className={styles.tablePanel}>
          <div className={styles.tableHead}>
            <span>Hunt #</span>
            <span>Break even x</span>
            <span>Slot name</span>
            <span className={styles.alignEnd}>Bet size</span>
            <span className={styles.alignEnd}>Win amount</span>
          </div>

          {bonuses.length === 0 ? (
            <p className={styles.empty}>
              {readyForNextHunt
                ? "Hunt ended — ready for the next one"
                : (board?.title ?? "").trim()
                  ? "New hunt — waiting for bonuses…"
                  : "Waiting for bonuses…"}
            </p>
          ) : (
            <div
              ref={viewportRef}
              className={styles.tableViewport}
              data-scrolling={shouldScroll || undefined}
            >
              <div
                className={styles.tableTrack}
                data-scrolling={shouldScroll || undefined}
                style={
                  shouldScroll
                    ? ({
                        "--scroll-duration": `${durationSec}s`,
                      } as CSSProperties)
                    : undefined
                }
              >
                <div ref={measureRef}>
                  <HuntListRows
                    bonuses={bonuses}
                    breakEvenLabel={breakEvenLabel}
                  />
                </div>
                {shouldScroll ? (
                  <HuntListRows
                    bonuses={bonuses}
                    breakEvenLabel={breakEvenLabel}
                    ariaHidden
                  />
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
