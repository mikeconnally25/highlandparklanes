"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { BonusHuntState, BonusItem } from "@/lib/bonus-hunt";
import {
  formatBetSize,
  formatMultiplier,
  getBonusMultiplier,
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
import styles from "./BonusOverlayWidget.module.css";

const POLL_MS = 1500;

function huntFingerprint(state: BonusHuntState): string {
  return [
    state.updatedAt,
    state.huntActive ? "1" : "0",
    state.title,
    String(state.startAmount ?? ""),
    state.bonuses
      .map(
        (bonus) =>
          `${bonus.id}:${bonus.name}:${bonus.betSize ?? ""}:${bonus.winAmount ?? ""}:${bonus.tier}:${bonus.requestedBy ?? ""}:${bonus.thumbnailUrl ?? ""}`,
      )
      .join("|"),
  ].join("::");
}

function huntNumberLabel(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return "#—";
  const match = trimmed.match(/#\s*(\d+)/i);
  if (match) return `#${match[1]}`;
  return trimmed.length > 18 ? `${trimmed.slice(0, 16)}…` : trimmed;
}

function money(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "$0.00";
  return formatBetSize(value);
}

function mult(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "0.00x";
  return formatMultiplier(value);
}

function findBestWin(bonuses: BonusItem[]): BonusItem | null {
  let best: BonusItem | null = null;
  for (const bonus of bonuses) {
    if (bonus.winAmount == null) continue;
    if (!best || (best.winAmount ?? 0) < bonus.winAmount) best = bonus;
  }
  return best;
}

function findLuckyWin(bonuses: BonusItem[]): BonusItem | null {
  let lucky: BonusItem | null = null;
  let luckyX = -1;
  for (const bonus of bonuses) {
    const x = getBonusMultiplier(bonus);
    if (x == null) continue;
    if (x > luckyX) {
      luckyX = x;
      lucky = bonus;
    }
  }
  return lucky;
}

type BonusOverlayWidgetProps = {
  mode?: "obs" | "preview";
  limit?: number;
  /** Admin preview: use the hunt board already loaded in the panel. */
  boardSeed?: BonusHuntState | null;
};

function BonusTableRows({
  bonuses,
  ariaHidden,
}: {
  bonuses: BonusItem[];
  ariaHidden?: boolean;
}) {
  return (
    <div className={styles.tableBody} aria-hidden={ariaHidden || undefined}>
      {bonuses.map((bonus, index) => {
        const payout =
          bonus.winAmount != null
            ? money(bonus.winAmount)
            : "—";
        const x = getBonusMultiplier(bonus);
        return (
          <div
            key={`${ariaHidden ? "dup-" : ""}${bonus.id}`}
            className={styles.tableRow}
            data-tier={bonus.tier !== "normal" ? bonus.tier : undefined}
          >
            <span className={styles.colIndex}>{index + 1}</span>
            <span className={styles.colGame} title={bonus.name}>
              <SlotThumbnail
                name={bonus.name}
                thumbnailUrl={bonus.thumbnailUrl}
              />
              <span className={styles.gameStack}>
                <span className={styles.gameName}>{bonus.name}</span>
                {bonus.requestedBy ? (
                  <span className={styles.requester}>@{bonus.requestedBy}</span>
                ) : null}
              </span>
            </span>
            <span className={styles.colBet}>{money(bonus.betSize)}</span>
            <span className={styles.colPayout}>
              {payout}
              {x != null ? (
                <span className={styles.payoutX}>{mult(x)}</span>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function BonusOverlayWidget({
  mode = "obs",
  limit,
  boardSeed = null,
}: BonusOverlayWidgetProps) {
  const effectiveLimit = limit ?? (mode === "obs" ? 100 : 24);
  const liveBoard = useHuntBoardState();
  const [board, setBoard] = useState<BonusHuntState | null>(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const fingerprintRef = useRef("");
  const boardRef = useRef<BonusHuntState | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);

  function applyBoard(next: BonusHuntState, opts?: { persist?: boolean }) {
    const merged =
      mode === "obs"
        ? resolveOverlayBoard(boardRef.current, next)
        : preferHuntBoard(boardRef.current, next);
    const fp = huntFingerprint(merged);
    if (fp === fingerprintRef.current && boardRef.current) return;

    if (isIntentionalReset(merged)) {
      clearOverlayHash();
    }

    fingerprintRef.current = fp;
    boardRef.current = merged;
    setBoard(merged);
    if (opts?.persist && mode !== "preview") writeHuntCache(merged);
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
    if (mode === "obs") return;
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
    const pollMs = mode === "preview" ? 4000 : POLL_MS;

    async function load() {
      try {
        const res = await fetch("/api/bonus-hunt", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load");
        const data = (await res.json()) as BonusHuntState;
        if (cancelled) return;
        applyBoard(data, { persist: false });
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) timer = setTimeout(load, pollMs);
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
  const bestWin = useMemo(() => findBestWin(bonuses), [bonuses]);
  const luckyWin = useMemo(() => findLuckyWin(bonuses), [bonuses]);
  const title = board?.title ?? "";
  const huntNo = huntNumberLabel(title);
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

  const durationSec = Math.max(16, bonuses.length * 2.2);

  return (
    <div
      className={`${styles.widget} ${mode === "preview" ? styles.preview : styles.obs}`}
      aria-live="polite"
      aria-label="Bonus hunt overlay"
    >
      <div className={styles.card}>
        <header className={styles.topBar}>
          <h2 className={styles.brand}>Bonus Hunt</h2>
          <p className={styles.huntNo}>{huntNo}</p>
        </header>

        <div className={styles.statsPanel}>
          <div className={styles.statsCol}>
            <div className={styles.statLine}>
              <span>Start:</span>
              <strong>{money(stats?.startAmount)}</strong>
            </div>
            <div className={styles.statLine}>
              <span>Total Bonuses:</span>
              <strong>{bonuses.length}</strong>
            </div>
            <div className={styles.statLine}>
              <span>Run Average:</span>
              <strong>{mult(stats?.avgXOpened)}</strong>
            </div>
          </div>
          <div className={styles.statsCol}>
            <div className={styles.statLine}>
              <span>Winnings:</span>
              <strong>{money(stats?.totalWins)}</strong>
            </div>
            <div className={styles.statLine}>
              <span>Remaining Bonuses:</span>
              <strong>{stats?.remainingCount ?? 0}</strong>
            </div>
            <div className={styles.statLine}>
              <span>Req Average</span>
              <strong>
                {stats?.breakEvenReached
                  ? "Hit"
                  : mult(stats?.breakEvenX)}
              </strong>
            </div>
          </div>
        </div>

        <div className={styles.highlights}>
          <div className={styles.highlight}>
            <div className={styles.highlightThumb} aria-hidden>
              <span className={styles.star}>★</span>
              <SlotThumbnail
                name={bestWin?.name ?? "?"}
                thumbnailUrl={bestWin?.thumbnailUrl ?? null}
                size="md"
              />
            </div>
            <div className={styles.highlightMeta}>
              <span className={styles.highlightLabel}>Best Win</span>
              <strong className={styles.highlightName}>
                {bestWin?.name ?? "—"}
              </strong>
              <span className={styles.highlightValue}>
                {money(bestWin?.winAmount)}{" "}
                <em>({money(bestWin?.betSize)})</em>
              </span>
            </div>
          </div>
          <div className={styles.highlight}>
            <div className={styles.highlightThumb} aria-hidden>
              <span className={styles.star}>★</span>
              <SlotThumbnail
                name={luckyWin?.name ?? "?"}
                thumbnailUrl={luckyWin?.thumbnailUrl ?? null}
                size="md"
              />
            </div>
            <div className={styles.highlightMeta}>
              <span className={styles.highlightLabel}>Lucky Win</span>
              <strong className={styles.highlightName}>
                {luckyWin?.name ?? "—"}
              </strong>
              <span className={styles.highlightValue}>
                {mult(luckyWin ? getBonusMultiplier(luckyWin) : null)}{" "}
                <em>({money(luckyWin?.winAmount)})</em>
              </span>
            </div>
          </div>
        </div>

        <div className={styles.tablePanel}>
          <div className={styles.tableHead}>
            <span>#</span>
            <span>Game</span>
            <span className={styles.alignEnd}>Bet Size</span>
            <span className={styles.alignEnd}>Payout</span>
          </div>

          {bonuses.length === 0 ? (
            <p className={styles.empty}>
              {readyForNextHunt
                ? "Hunt ended — ready for the next one"
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
                  <BonusTableRows bonuses={bonuses} />
                </div>
                {shouldScroll ? (
                  <BonusTableRows bonuses={bonuses} ariaHidden />
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
