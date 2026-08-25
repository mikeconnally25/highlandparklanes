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

const ADMIN_TOKEN_KEY = "blakjac21-guess-admin-token";

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
  const [adminToken, setAdminToken] = useState(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? "";
  });
  const [showDeleteControls, setShowDeleteControls] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    sessionStorage.setItem(ADMIN_TOKEN_KEY, adminToken);

    try {
      const res = await fetch("/api/bonus-hunt/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken,
        },
        body: JSON.stringify({ action, id }),
      });
      const data = (await res.json()) as {
        error?: string;
        hunts?: PastHuntResult[];
      };
      if (!res.ok) {
        setError(data.error ?? "Could not delete hunt");
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
    if (!window.confirm(`Delete past hunt “${title}”? This cannot be undone.`)) {
      return;
    }
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
    setOpenId(null);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.deleteSection}>
        <button
          type="button"
          className={styles.deleteToggle}
          aria-expanded={showDeleteControls}
          onClick={() => setShowDeleteControls((open) => !open)}
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
            <label className={styles.label}>
              Admin token
              <input
                className={styles.input}
                type="text"
                value={adminToken}
                onChange={(e) => setAdminToken(e.target.value)}
                placeholder="Paste GUESS_ADMIN_TOKEN from .env.local"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <button
              type="button"
              className={styles.clearAllBtn}
              disabled={busy || hunts.length === 0 || !adminToken.trim()}
              onClick={() => void clearAll()}
            >
              Delete all past hunts
            </button>
            <p className={styles.deleteHint}>
              Paste your admin token, then delete individual hunts below or
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
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    disabled={busy || !adminToken.trim()}
                    onClick={() => void deleteHunt(hunt.id, hunt.title)}
                    aria-label={`Delete ${hunt.title}`}
                    title={
                      adminToken.trim()
                        ? "Delete this past hunt"
                        : "Open Delete past hunts and paste admin token first"
                    }
                  >
                    Delete
                  </button>
                </div>

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
                        <p className={styles.statValue}>
                          {profitLabel(hunt)}
                        </p>
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
                            {sortBonusesForDisplay(hunt.bonuses).map(
                              (bonus, index) => (
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
                                    {formatMultiplier(
                                      getBonusMultiplier(bonus),
                                    )}
                                  </td>
                                  <td className={styles.tier}>{bonus.tier}</td>
                                </tr>
                              ),
                            )}
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
      )}
    </div>
  );
}
