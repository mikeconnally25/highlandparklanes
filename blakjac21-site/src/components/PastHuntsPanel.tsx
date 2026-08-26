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
import { useSiteSession } from "@/hooks/useSiteSession";
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
  const { isAdmin, ready: sessionReady } = useSiteSession();
  const [hunts, setHunts] = useState<PastHuntResult[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showDeleteControls, setShowDeleteControls] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) setShowDeleteControls(true);
  }, [isAdmin]);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
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

    tick();
    const timer = setInterval(tick, 5000);
    const onHistory = () => {
      void tick();
    };
    window.addEventListener("bonus-hunt-history-changed", onHistory);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("bonus-hunt-history-changed", onHistory);
    };
  }, []);

  async function adminDelete(
    action: "delete-past-hunt" | "clear-past-hunts",
    id?: string,
  ) {
    setError(null);
    setBusy(true);

    try {
      const res = await fetch("/api/bonus-hunt/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, id }),
      });
      const data = (await res.json()) as {
        error?: string;
        hunts?: PastHuntResult[];
      };
      if (!res.ok) {
        setError(
          data.error === "Unauthorized"
            ? "Sign in with the admin Kick account to delete hunts"
            : (data.error ?? "Could not delete hunt"),
        );
        return;
      }
      setHunts(data.hunts ?? []);
      if (id && openId === id) setOpenId(null);
      window.dispatchEvent(new Event("bonus-hunt-history-changed"));
    } catch {
      setError("Could not reach server");
    } finally {
      setBusy(false);
    }
  }

  async function deleteHunt(id: string, title: string) {
    if (!window.confirm(`Delete past hunt “${title}”?`)) return;
    await adminDelete("delete-past-hunt", id);
  }

  async function clearAll() {
    if (
      !window.confirm(
        `Delete all ${hunts.length} past hunt${hunts.length === 1 ? "" : "s"}? This cannot be undone.`,
      )
    ) {
      return;
    }
    await adminDelete("clear-past-hunts");
  }

  return (
    <section className={styles.wrap} aria-labelledby="past-hunts-heading">
      <div className={styles.header}>
        <h2 id="past-hunts-heading" className={styles.title}>
          Past hunts
        </h2>
        <span className={styles.count}>{hunts.length}</span>
      </div>

      {sessionReady && isAdmin ? (
        <div className={styles.deleteControls}>
          <button
            type="button"
            className={styles.deleteToggle}
            aria-expanded={showDeleteControls}
            onClick={() => setShowDeleteControls((v) => !v)}
          >
            Delete past hunts
            <span
              className={styles.chevron}
              data-open={showDeleteControls || undefined}
              aria-hidden
            />
          </button>

          {showDeleteControls ? (
            <div className={styles.deletePanel}>
              <button
                type="button"
                className={styles.clearAllBtn}
                disabled={busy || hunts.length === 0}
                onClick={() => void clearAll()}
              >
                Delete all past hunts
              </button>
              <p className={styles.deleteHint}>
                Signed in as admin via Kick. Delete individual hunts below or
                clear the full archive.
              </p>
              {error ? (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {hunts.length === 0 ? (
        <p className={styles.empty}>
          Ended hunts show up here. Use <strong>End hunt</strong> in streamer
          controls to archive the active board.
        </p>
      ) : (
        <ul className={styles.list}>
          {hunts.map((hunt) => {
            const open = openId === hunt.id;
            return (
              <li key={hunt.id} className={styles.item}>
                <div className={styles.itemHeader}>
                  <button
                    type="button"
                    className={styles.itemToggle}
                    aria-expanded={open}
                    onClick={() =>
                      setOpenId((current) =>
                        current === hunt.id ? null : hunt.id,
                      )
                    }
                  >
                    <span className={styles.itemTitle}>{hunt.title}</span>
                    <span className={styles.itemMeta}>
                      {hunt.bonuses.length} bonus
                      {hunt.bonuses.length === 1 ? "" : "es"} ·{" "}
                      {profitLabel(hunt)} · {formatWhen(hunt.endedAt)}
                    </span>
                    <span
                      className={styles.chevron}
                      data-open={open || undefined}
                      aria-hidden
                    />
                  </button>
                  {sessionReady && isAdmin ? (
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      disabled={busy}
                      onClick={() => void deleteHunt(hunt.id, hunt.title)}
                      aria-label={`Delete ${hunt.title}`}
                      title="Delete this past hunt"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>

                {open ? (
                  <div className={styles.detail}>
                    <div className={styles.stats}>
                      <div>
                        <span className={styles.statLabel}>Start</span>
                        <span className={styles.statValue}>
                          {formatBetSize(hunt.stats.startAmount)}
                        </span>
                      </div>
                      <div>
                        <span className={styles.statLabel}>Bet</span>
                        <span className={styles.statValue}>
                          {formatBetSize(
                            hunt.stats.totalBet > 0 ? hunt.stats.totalBet : null,
                          )}
                        </span>
                      </div>
                      <div>
                        <span className={styles.statLabel}>Wins</span>
                        <span className={styles.statValue}>
                          {formatBetSize(
                            hunt.stats.totalWins > 0
                              ? hunt.stats.totalWins
                              : null,
                          )}
                        </span>
                      </div>
                      <div>
                        <span className={styles.statLabel}>Avg x</span>
                        <span className={styles.statValue}>
                          {formatMultiplier(hunt.stats.avgXOpened)}
                        </span>
                      </div>
                      <div>
                        <span className={styles.statLabel}>BE x</span>
                        <span className={styles.statValue}>
                          {formatBreakEvenLabel(hunt.stats)}
                        </span>
                      </div>
                    </div>
                    <ul className={styles.bonusList}>
                      {sortBonusesForDisplay(hunt.bonuses).map((bonus, i) => (
                        <li key={bonus.id} className={styles.bonusItem}>
                          <span className={styles.bonusIndex}>#{i + 1}</span>
                          <span className={styles.bonusName}>{bonus.name}</span>
                          <span className={styles.bonusBet}>
                            {formatBetSize(bonus.betSize)}
                          </span>
                          <span className={styles.bonusWin}>
                            {formatBetSize(bonus.winAmount)}
                          </span>
                          <span className={styles.bonusX}>
                            {formatMultiplier(getBonusMultiplier(bonus))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
