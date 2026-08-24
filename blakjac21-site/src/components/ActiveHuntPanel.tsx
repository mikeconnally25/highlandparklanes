"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { BonusHuntState, BonusTier } from "@/lib/bonus-hunt";
import {
  formatBetSize,
  formatBreakEvenLabel,
  formatMultiplier,
  getBonusMultiplier,
  getHuntStats,
  isSlotRequestMessage,
} from "@/lib/bonus-hunt";
import { useKickChat } from "@/hooks/useKickChat";
import styles from "./ActiveHuntPanel.module.css";

const ADMIN_TOKEN_KEY = "blakjac21-guess-admin-token";

async function fetchState(): Promise<BonusHuntState> {
  const res = await fetch("/api/bonus-hunt", { cache: "no-store" });
  return (await res.json()) as BonusHuntState;
}

function tierLabel(tier: BonusTier): string {
  if (tier === "super") return "Super";
  if (tier === "epic") return "Epic";
  return "Normal";
}

export function ActiveHuntPanel() {
  const [state, setState] = useState<BonusHuntState | null>(null);
  const [chatroomId, setChatroomId] = useState<number | null>(null);
  const [adminToken, setAdminToken] = useState(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? "";
  });
  const [showAdmin, setShowAdmin] = useState(true);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bonusName, setBonusName] = useState("");
  const [betSize, setBetSize] = useState("");
  const [startAmountInput, setStartAmountInput] = useState("");
  const [superTier, setSuperTier] = useState(false);
  const [epicTier, setEpicTier] = useState(false);
  const [huntTitle, setHuntTitle] = useState("");
  const [winDrafts, setWinDrafts] = useState<Record<string, string>>({});

  const requestsOpen = state?.requestsOpen ?? false;
  const chatConnected = Boolean(requestsOpen && chatroomId);

  const selectedTier: BonusTier =
    epicTier ? "epic" : superTier ? "super" : "normal";

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const next = await fetchState();
        if (!cancelled) {
          setState(next);
          setHuntTitle((current) => (current ? current : next.title));
          setStartAmountInput((current) =>
            current
              ? current
              : next.startAmount != null
                ? String(next.startAmount)
                : "",
          );
          setWinDrafts((current) => {
            const nextDrafts = { ...current };
            for (const bonus of next.bonuses) {
              if (nextDrafts[bonus.id] === undefined) {
                nextDrafts[bonus.id] =
                  bonus.winAmount != null ? String(bonus.winAmount) : "";
              }
            }
            return nextDrafts;
          });
        }
      } catch {
        /* ignore */
      }
    }

    load();
    const timer = setInterval(load, 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadChatroom() {
      try {
        const res = await fetch("/api/kick/chatroom", { cache: "no-store" });
        const data = (await res.json()) as { chatroomId?: number };
        if (!cancelled && data.chatroomId) setChatroomId(data.chatroomId);
      } catch {
        if (!cancelled) setChatroomId(null);
      }
    }

    loadChatroom();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChatMessage = useCallback(
    async (message: { username: string; content: string }) => {
      if (!requestsOpen) return;
      if (!isSlotRequestMessage(message.content)) return;

      try {
        const res = await fetch("/api/bonus-hunt/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: message.username,
            message: message.content,
          }),
        });
        if (res.ok) {
          const next = (await res.json()) as BonusHuntState;
          setState(next);
        }
      } catch {
        /* ignore */
      }
    },
    [requestsOpen],
  );

  useKickChat({
    chatroomId,
    enabled: chatConnected,
    onMessage: handleChatMessage,
  });

  async function adminRequest(
    url: string,
    body?: object,
  ): Promise<BonusHuntState | null> {
    setAdminError(null);
    setBusy(true);
    sessionStorage.setItem(ADMIN_TOKEN_KEY, adminToken);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setAdminError(data.error ?? "Admin request failed");
        return null;
      }

      const next = (await res.json()) as BonusHuntState;
      setState(next);
      return next;
    } catch {
      setAdminError("Could not reach server");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function handleAddBonus(event: FormEvent) {
    event.preventDefault();
    const next = await adminRequest("/api/bonus-hunt/bonus", {
      name: bonusName,
      betSize,
      tier: selectedTier,
    });
    if (next) {
      setBonusName("");
      setBetSize("");
      setSuperTier(false);
      setEpicTier(false);
    }
  }

  function toggleSuper() {
    setSuperTier((current) => {
      const next = !current;
      if (next) setEpicTier(false);
      return next;
    });
  }

  function toggleEpic() {
    setEpicTier((current) => {
      const next = !current;
      if (next) setSuperTier(false);
      return next;
    });
  }

  const bonuses = state?.bonuses ?? [];
  const slotRequests = state?.slotRequests ?? [];
  const stats = state ? getHuntStats(state) : null;

  async function saveStartAmount() {
    await adminRequest("/api/bonus-hunt/admin", {
      action: "set-start-amount",
      startAmount: startAmountInput,
    });
  }

  async function saveWinAmount(id: string) {
    const next = await adminRequest("/api/bonus-hunt/admin", {
      action: "set-win-amount",
      id,
      winAmount: winDrafts[id] ?? "",
    });
    if (next) {
      const bonus = next.bonuses.find((item) => item.id === id);
      setWinDrafts((current) => ({
        ...current,
        [id]: bonus?.winAmount != null ? String(bonus.winAmount) : "",
      }));
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.statusRow}>
        <span
          className={`${styles.statusBadge} ${state?.huntActive ? styles.statusOpen : styles.statusClosed}`}
        >
          {state?.huntActive ? "Hunt active" : "No active hunt"}
        </span>
        <span
          className={`${styles.statusBadge} ${requestsOpen ? styles.statusOpen : styles.statusClosed}`}
        >
          {requestsOpen ? "Slot requests open" : "Slot requests closed"}
        </span>
        <span className={styles.chatStatus}>
          {requestsOpen
            ? chatConnected
              ? "Listening for !r in Kick chat"
              : "Connecting to chat…"
            : "Open requests to capture !r"}
        </span>
      </div>

      {state?.title ? <p className={styles.huntTitle}>{state.title}</p> : null}

      <section className={styles.block} aria-labelledby="hunt-bankroll-heading">
        <div className={styles.blockHeader}>
          <h3 id="hunt-bankroll-heading" className={styles.blockTitle}>
            Hunt bankroll
          </h3>
        </div>
        <div className={styles.bankrollRow}>
          <label className={styles.label}>
            Started with
            <input
              className={styles.input}
              type="text"
              inputMode="decimal"
              value={startAmountInput}
              onChange={(e) => setStartAmountInput(e.target.value)}
              placeholder="e.g. 500 or $1,000"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <button
            type="button"
            className={styles.addBtn}
            disabled={busy}
            onClick={saveStartAmount}
          >
            Save start amount
          </button>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <p className={styles.statLabel}>Avg x opened</p>
            <p className={styles.statValue}>
              {formatMultiplier(stats?.avgXOpened ?? null)}
            </p>
            <p className={styles.statHint}>
              {stats?.openedCount
                ? `From ${stats.openedCount} opened bonus${stats.openedCount === 1 ? "" : "es"}`
                : "Log win amounts below to track"}
            </p>
          </div>
          <div className={styles.statCard}>
            <p className={styles.statLabel}>Avg x to break even</p>
            <p className={styles.statValue}>
              {stats ? formatBreakEvenLabel(stats) : "—"}
            </p>
            <p className={styles.statHint}>
              {stats?.breakEvenReached
                ? `Recovered ${formatBetSize(stats.totalWins)} of ${formatBetSize(stats.startAmount)}`
                : stats?.remainingToRecover != null && stats.remainingBet > 0
                  ? `${formatBetSize(stats.remainingToRecover)} left ÷ ${formatBetSize(stats.remainingBet)} remaining bet`
                  : stats?.startAmount != null && stats.openedCount === 0 && stats.totalBet > 0
                    ? `${formatBetSize(stats.startAmount)} ÷ ${formatBetSize(stats.totalBet)} total bet`
                    : "Needs start amount, bets, and remaining bonuses"}
            </p>
          </div>
        </div>
      </section>

      <section className={styles.block} aria-labelledby="bonus-list-heading">
        <div className={styles.blockHeader}>
          <h3 id="bonus-list-heading" className={styles.blockTitle}>
            Bonus list
          </h3>
          <span className={styles.count}>{bonuses.length}</span>
        </div>

        <form className={styles.addForm} onSubmit={handleAddBonus}>
          <div className={styles.formGrid}>
            <label className={styles.label}>
              Bonus name
              <input
                className={styles.input}
                type="text"
                value={bonusName}
                onChange={(e) => setBonusName(e.target.value)}
                placeholder="e.g. Sugar Rush 1000"
                autoComplete="off"
                spellCheck={false}
              />
            </label>

            <label className={styles.label}>
              Bet size
              <input
                className={styles.input}
                type="text"
                inputMode="decimal"
                value={betSize}
                onChange={(e) => setBetSize(e.target.value)}
                placeholder="$0.01 – $1,000"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
          </div>

          <div className={styles.tierRow} role="group" aria-label="Bonus tier">
            <button
              type="button"
              className={`${styles.tierToggle} ${styles.tierSuper}`}
              aria-pressed={superTier}
              data-active={superTier || undefined}
              onClick={toggleSuper}
            >
              Super
            </button>
            <button
              type="button"
              className={`${styles.tierToggle} ${styles.tierEpic}`}
              aria-pressed={epicTier}
              data-active={epicTier || undefined}
              onClick={toggleEpic}
            >
              Epic
            </button>
          </div>

          <button
            type="submit"
            className={styles.addBtn}
            disabled={busy || !bonusName.trim()}
          >
            Add to list
          </button>
        </form>

        {bonuses.length === 0 ? (
          <p className={styles.empty}>No bonuses added yet.</p>
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
                  <th scope="col">
                    <span className={styles.srOnly}>Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {bonuses.map((bonus, index) => (
                  <tr
                    key={bonus.id}
                    data-tier={bonus.tier !== "normal" ? bonus.tier : undefined}
                  >
                    <td className={styles.colIndex}>{index + 1}</td>
                    <td className={styles.colName}>{bonus.name}</td>
                    <td className={styles.colBet}>{formatBetSize(bonus.betSize)}</td>
                    <td className={styles.colWin}>
                      <div className={styles.winEditor}>
                        <input
                          className={styles.winInput}
                          type="text"
                          inputMode="decimal"
                          value={winDrafts[bonus.id] ?? ""}
                          onChange={(e) =>
                            setWinDrafts((current) => ({
                              ...current,
                              [bonus.id]: e.target.value,
                            }))
                          }
                          placeholder="0"
                          aria-label={`Win amount for ${bonus.name}`}
                        />
                        <button
                          type="button"
                          className={styles.winSave}
                          disabled={busy}
                          onClick={() => saveWinAmount(bonus.id)}
                        >
                          Save
                        </button>
                      </div>
                    </td>
                    <td className={styles.colX}>
                      {formatMultiplier(getBonusMultiplier(bonus))}
                    </td>
                    <td className={styles.colTier}>
                      {bonus.tier !== "normal" ? (
                        <span className={styles.tierBadge} data-tier={bonus.tier}>
                          {tierLabel(bonus.tier)}
                        </span>
                      ) : (
                        <span className={styles.tierMuted}>Normal</span>
                      )}
                    </td>
                    <td className={styles.colAction}>
                      <button
                        type="button"
                        className={styles.removeBtn}
                        disabled={busy}
                        onClick={() =>
                          adminRequest("/api/bonus-hunt/bonus/remove", {
                            id: bonus.id,
                          })
                        }
                        aria-label={`Remove ${bonus.name}`}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.block} aria-labelledby="slot-queue-heading">
        <div className={styles.blockHeader}>
          <h3 id="slot-queue-heading" className={styles.blockTitle}>
            Slot requests
          </h3>
          <span className={styles.count}>{slotRequests.length}</span>
        </div>
        <p className={styles.help}>
          Viewers type <code>!r</code> in Kick chat when requests are open. One
          request per username.
        </p>
        {slotRequests.length === 0 ? (
          <p className={styles.empty}>No slot requests yet.</p>
        ) : (
          <ol className={styles.list}>
            {slotRequests.map((req, index) => (
              <li key={req.id} className={styles.item}>
                <span className={styles.itemIndex}>{index + 1}</span>
                <span className={styles.itemName}>{req.username}</span>
                <button
                  type="button"
                  className={styles.removeBtn}
                  disabled={busy}
                  onClick={() =>
                    adminRequest("/api/bonus-hunt/admin", {
                      action: "remove-request",
                      id: req.id,
                    })
                  }
                  aria-label={`Remove ${req.username}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className={styles.admin}>
        <button
          type="button"
          className={styles.adminToggle}
          aria-expanded={showAdmin}
          onClick={() => setShowAdmin((v) => !v)}
        >
          Streamer controls
          <span className={styles.adminChevron} data-open={showAdmin || undefined} />
        </button>

        {showAdmin ? (
          <div className={styles.adminPanel}>
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

            <label className={styles.label}>
              Hunt title
              <div className={styles.titleRow}>
                <input
                  className={styles.input}
                  type="text"
                  value={huntTitle}
                  onChange={(e) => setHuntTitle(e.target.value)}
                  placeholder="e.g. Sunday sub day hunt"
                  autoComplete="off"
                />
                <button
                  type="button"
                  className={styles.adminBtnSecondary}
                  disabled={busy}
                  onClick={() =>
                    adminRequest("/api/bonus-hunt/admin", {
                      action: "set-title",
                      title: huntTitle,
                    })
                  }
                >
                  Save
                </button>
              </div>
            </label>

            <div className={styles.adminActions}>
              <button
                type="button"
                className={styles.adminBtnPrimary}
                disabled={busy || requestsOpen}
                onClick={() =>
                  adminRequest("/api/bonus-hunt/toggle", { open: true })
                }
              >
                Open !r requests
              </button>
              <button
                type="button"
                className={styles.adminBtnSecondary}
                disabled={busy || !requestsOpen}
                onClick={() =>
                  adminRequest("/api/bonus-hunt/toggle", { open: false })
                }
              >
                Close !r requests
              </button>
              <button
                type="button"
                className={styles.adminBtnSecondary}
                disabled={busy}
                onClick={() =>
                  adminRequest("/api/bonus-hunt/bonus/remove", { all: true })
                }
              >
                Clear bonuses
              </button>
              <button
                type="button"
                className={styles.adminBtnSecondary}
                disabled={busy}
                onClick={() =>
                  adminRequest("/api/bonus-hunt/admin", {
                    action: "clear-requests",
                  })
                }
              >
                Clear slot queue
              </button>
              <button
                type="button"
                className={styles.adminBtnSecondary}
                disabled={busy || !state?.huntActive}
                onClick={() =>
                  adminRequest("/api/bonus-hunt/admin", {
                    action: "set-active",
                    active: false,
                  })
                }
              >
                End hunt
              </button>
            </div>

            {adminError ? (
              <p className={styles.adminError} role="alert">
                {adminError}
              </p>
            ) : null}
            <p className={styles.adminHint}>
              Uses the same <code>GUESS_ADMIN_TOKEN</code> as Guess the Balance.
              Toggle Super or Epic before adding a bonus to tag it.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
