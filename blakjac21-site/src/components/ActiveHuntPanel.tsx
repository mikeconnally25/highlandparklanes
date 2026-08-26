"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { BonusHuntState, BonusTier } from "@/lib/bonus-hunt";
import {
  formatBetSize,
  formatBreakEvenLabel,
  formatMultiplier,
  getBonusMultiplier,
  getHuntStats,
  parseSlotRequestMessage,
  sortBonusesForDisplay,
} from "@/lib/bonus-hunt";
import { useKickChat } from "@/hooks/useKickChat";
import { useSiteSession } from "@/hooks/useSiteSession";
import { ObsOverlayLink } from "@/components/ObsOverlayLink";
import styles from "./ActiveHuntPanel.module.css";

type SlotCatalogSummary = {
  counts: { total: number; onlyOnStake: number; newReleases: number };
  expectedCounts: { "only-on-stake": number; "new-releases": number };
  updatedAt: string | null;
  nextRefreshAt: string | null;
  refreshIntervalSeconds: number;
  refreshing: boolean;
  lastError: string | null;
};

async function fetchState(): Promise<BonusHuntState> {
  const res = await fetch("/api/bonus-hunt", { cache: "no-store" });
  return (await res.json()) as BonusHuntState;
}

function tierLabel(tier: BonusTier): string {
  if (tier === "super") return "Super";
  if (tier === "epic") return "Epic";
  return "Normal";
}

function preferState(
  local: BonusHuntState | null,
  remote: BonusHuntState,
  guardUntil: number,
): BonusHuntState {
  if (!local) return remote;
  const localT = Date.parse(local.updatedAt) || 0;
  const remoteT = Date.parse(remote.updatedAt) || 0;
  const guarded = Date.now() < guardUntil;

  // Ignore empty/cold remote snapshots while we still have fresher local edits
  if (guarded && remoteT < localT) return local;
  if (guarded && remote.bonuses.length < local.bonuses.length && remoteT <= localT) {
    return local;
  }
  if (remoteT < localT) return local;
  return remote;
}

export function ActiveHuntPanel() {
  const { isAdmin, ready: sessionReady, user } = useSiteSession();
  const canManage = Boolean(user && isAdmin);
  const [state, setState] = useState<BonusHuntState | null>(null);
  const [chatroomId, setChatroomId] = useState<number | null>(null);
  const [showAdmin, setShowAdmin] = useState(true);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bonusName, setBonusName] = useState("");
  const [betSize, setBetSize] = useState("");
  const [winAmount, setWinAmount] = useState("");
  const [startAmountInput, setStartAmountInput] = useState("");
  const [superTier, setSuperTier] = useState(false);
  const [epicTier, setEpicTier] = useState(false);
  const [huntTitle, setHuntTitle] = useState("");
  const [winDrafts, setWinDrafts] = useState<Record<string, string>>({});
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  );
  const [slotCatalog, setSlotCatalog] = useState<SlotCatalogSummary | null>(
    null,
  );
  const [formFocused, setFormFocused] = useState(false);
  const guardUntilRef = useRef(0);
  const stateRef = useRef<BonusHuntState | null>(null);

  useEffect(() => {
    if (canManage) setShowAdmin(true);
  }, [canManage]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const requestsOpen = state?.requestsOpen ?? false;
  const chatConnected = Boolean(requestsOpen && chatroomId);

  const selectedTier: BonusTier =
    epicTier ? "epic" : superTier ? "super" : "normal";

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const next = await fetchState();
        if (cancelled) return;
        setState((prev) => {
          const merged = preferState(prev, next, guardUntilRef.current);
          // Don't clobber in-progress form drafts from a poll while typing
          if (formFocused && prev && merged !== next) {
            return prev;
          }
          if (merged === next) {
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
          return merged;
        });
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
  }, [formFocused]);

  useEffect(() => {
    let cancelled = false;

    async function loadSlots() {
      try {
        const res = await fetch("/api/bonus-hunt/slots", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as SlotCatalogSummary;
        if (!cancelled) setSlotCatalog(data);
      } catch {
        /* ignore */
      }
    }

    loadSlots();
    const timer = setInterval(loadSlots, 10_000);
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
      if (!parseSlotRequestMessage(message.content)) return;

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

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setAdminError(
          data.error === "Unauthorized"
            ? "Sign in with the admin Kick account to use streamer controls"
            : (data.error ?? "Admin request failed"),
        );
        return null;
      }

      const next = (await res.json()) as BonusHuntState & {
        archived?: unknown;
      };
      guardUntilRef.current = Date.now() + 20_000;
      setState(next);
      if (url.includes("/api/bonus-hunt/admin") && body && "action" in body) {
        const action = (body as { action?: string }).action;
        if (action === "end-hunt") {
          setWinDrafts({});
          setSelectedRequestId(null);
          setBonusName("");
          setBetSize("");
          setWinAmount("");
          setHuntTitle("");
          setStartAmountInput("");
          window.dispatchEvent(new Event("bonus-hunt-history-changed"));
        }
      }
      return next;
    } catch {
      setAdminError("Could not reach server");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function refreshSlotCatalog() {
    setAdminError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/bonus-hunt/slots?refresh=1", {
        cache: "no-store",
      });
      const data = (await res.json()) as SlotCatalogSummary & {
        error?: string;
      };
      if (!res.ok) {
        setAdminError(
          data.error === "Unauthorized"
            ? "Sign in with the admin Kick account to use streamer controls"
            : (data.error ?? "Slot catalog refresh failed"),
        );
        return;
      }
      setSlotCatalog(data);
    } catch {
      setAdminError("Slot catalog refresh failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddBonus(event: FormEvent) {
    event.preventDefault();

    if (selectedRequestId) {
      const next = await adminRequest("/api/bonus-hunt/admin", {
        action: "promote-request",
        id: selectedRequestId,
        betSize,
        winAmount,
        tier: selectedTier,
      });
      if (next) {
        setSelectedRequestId(null);
        setBonusName("");
        setBetSize("");
        setWinAmount("");
        setSuperTier(false);
        setEpicTier(false);
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
      return;
    }

    const next = await adminRequest("/api/bonus-hunt/bonus", {
      name: bonusName,
      betSize,
      winAmount,
      tier: selectedTier,
    });
    if (next) {
      setBonusName("");
      setBetSize("");
      setWinAmount("");
      setSuperTier(false);
      setEpicTier(false);
    }
  }

  function selectRequest(id: string, slotName: string) {
    setSelectedRequestId((current) => {
      if (current === id) {
        setBonusName("");
        return null;
      }
      setBonusName(slotName);
      return id;
    });
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

  const bonuses = sortBonusesForDisplay(state?.bonuses ?? []);
  const slotRequests = state?.slotRequests ?? [];
  const stats = state ? getHuntStats(state) : null;

  useEffect(() => {
    if (!selectedRequestId) return;
    if (slotRequests.some((req) => req.id === selectedRequestId)) return;
    setSelectedRequestId(null);
  }, [selectedRequestId, slotRequests]);

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
              ? "Listening for !s <slot> in Kick chat"
              : "Connecting to chat…"
            : "Open requests to capture !s <slot>"}
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
          {canManage ? (
            <>
              <label className={styles.label}>
                Started with
                <input
                  className={styles.input}
                  type="text"
                  inputMode="decimal"
                  value={startAmountInput}
                  onFocus={() => setFormFocused(true)}
                  onBlur={() => setFormFocused(false)}
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
            </>
          ) : (
            <p className={styles.statHint}>
              Started with{" "}
              <strong>{formatBetSize(stats?.startAmount ?? null)}</strong>
            </p>
          )}
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
            Bonuses & requests
          </h3>
          <span className={styles.count}>
            {bonuses.length}
            {slotRequests.length ? ` / ${slotRequests.length}` : ""}
          </span>
        </div>

        <p className={styles.help}>
          Viewers type <code>!s Slot Name</code> in Kick chat when requests are
          open (Only on Stake / New Releases, up to 3 per user, no duplicates).
          Select a request below, set bet and win, then add it to the hunt list.
        </p>

        <div className={styles.subBlock}>
          <div className={styles.subHeader}>
            <h4 className={styles.subTitle}>Chat requests</h4>
            <span className={styles.subCount}>{slotRequests.length}</span>
          </div>
          {slotRequests.length === 0 ? (
            <p className={styles.empty}>No slot requests yet.</p>
          ) : (
            <ul className={styles.requestList}>
              {slotRequests.map((req, index) => {
                const selected = selectedRequestId === req.id;
                return (
                  <li key={req.id}>
                    {canManage ? (
                      <button
                        type="button"
                        className={styles.requestRow}
                        data-selected={selected || undefined}
                        disabled={busy}
                        onClick={() => selectRequest(req.id, req.slotName)}
                        aria-pressed={selected}
                      >
                        <span className={styles.itemIndex}>{index + 1}</span>
                        <span className={styles.itemMeta}>
                          <span className={styles.itemName}>{req.username}</span>
                          <span className={styles.itemSlot}>{req.slotName}</span>
                        </span>
                        <span className={styles.selectHint}>
                          {selected ? "Selected" : "Select"}
                        </span>
                      </button>
                    ) : (
                      <div className={styles.requestRow}>
                        <span className={styles.itemIndex}>{index + 1}</span>
                        <span className={styles.itemMeta}>
                          <span className={styles.itemName}>{req.username}</span>
                          <span className={styles.itemSlot}>{req.slotName}</span>
                        </span>
                      </div>
                    )}
                    {canManage ? (
                      <button
                        type="button"
                        className={styles.removeBtn}
                        disabled={busy}
                        onClick={() => {
                          if (selectedRequestId === req.id) {
                            setSelectedRequestId(null);
                            setBonusName("");
                          }
                          void adminRequest("/api/bonus-hunt/admin", {
                            action: "remove-request",
                            id: req.id,
                          });
                        }}
                        aria-label={`Dismiss ${req.slotName}`}
                      >
                        ×
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {canManage ? (
        <form
          className={styles.addForm}
          onSubmit={handleAddBonus}
          onFocusCapture={() => setFormFocused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setFormFocused(false);
            }
          }}
        >
          <div className={styles.formGridThree}>
            <label className={styles.label}>
              Bonus name
              <input
                className={styles.input}
                type="text"
                value={bonusName}
                onChange={(e) => {
                  setBonusName(e.target.value);
                  if (selectedRequestId) setSelectedRequestId(null);
                }}
                placeholder={
                  selectedRequestId
                    ? "Selected from chat request"
                    : "Select a request or type a name"
                }
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
                placeholder=".01 to 1000"
                autoComplete="off"
                spellCheck={false}
              />
            </label>

            <label className={styles.label}>
              Win
              <input
                className={styles.input}
                type="text"
                inputMode="decimal"
                value={winAmount}
                onChange={(e) => setWinAmount(e.target.value)}
                placeholder="Optional"
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
            {selectedRequestId ? "Add selected to list" : "Add to list"}
          </button>
        </form>
        ) : null}

        <div className={styles.subBlock}>
          <div className={styles.subHeader}>
            <h4 className={styles.subTitle}>Hunt list</h4>
            <span className={styles.subCount}>{bonuses.length}</span>
          </div>
          {bonuses.length === 0 ? (
            <p className={styles.empty}>No bonuses on the list yet.</p>
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
                      data-tier={
                        bonus.tier !== "normal" ? bonus.tier : undefined
                      }
                    >
                      <td className={styles.colIndex}>{index + 1}</td>
                      <td className={styles.colName}>
                        <span className={styles.bonusName}>{bonus.name}</span>
                        {bonus.requestedBy ? (
                          <span className={styles.bonusRequester}>
                            {bonus.requestedBy}
                          </span>
                        ) : null}
                      </td>
                      <td className={styles.colBet}>
                        {formatBetSize(bonus.betSize)}
                      </td>
                      <td className={styles.colWin}>
                        {canManage ? (
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
                        ) : (
                          formatBetSize(bonus.winAmount)
                        )}
                      </td>
                      <td className={styles.colX}>
                        {formatMultiplier(getBonusMultiplier(bonus))}
                      </td>
                      <td className={styles.colTier}>
                        {bonus.tier !== "normal" ? (
                          <span
                            className={styles.tierBadge}
                            data-tier={bonus.tier}
                          >
                            {tierLabel(bonus.tier)}
                          </span>
                        ) : (
                          <span className={styles.tierMuted}>Normal</span>
                        )}
                      </td>
                      <td className={styles.colAction}>
                        {canManage ? (
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
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {canManage ? (
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
                  Open !s requests
                </button>
                <button
                  type="button"
                  className={styles.adminBtnSecondary}
                  disabled={busy || !requestsOpen}
                  onClick={() =>
                    adminRequest("/api/bonus-hunt/toggle", { open: false })
                  }
                >
                  Close !s requests
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
                      action: "end-hunt",
                    })
                  }
                >
                  End hunt
                </button>
                <button
                  type="button"
                  className={styles.adminBtnSecondary}
                  disabled={busy || Boolean(slotCatalog?.refreshing)}
                  onClick={() => void refreshSlotCatalog()}
                >
                  {slotCatalog?.refreshing
                    ? "Refreshing slots…"
                    : "Refresh Stake slots"}
                </button>
              </div>

              {slotCatalog ? (
                <p className={styles.adminHint}>
                  Slot catalog: {slotCatalog.counts.total.toLocaleString()} cached
                  {slotCatalog.updatedAt
                    ? ` · last ${new Date(slotCatalog.updatedAt).toLocaleString()}`
                    : " · not crawled yet"}
                  {slotCatalog.nextRefreshAt
                    ? ` · next auto ${new Date(slotCatalog.nextRefreshAt).toLocaleString()}`
                    : " · auto every 10s when stale"}
                  {slotCatalog.lastError
                    ? ` · error: ${slotCatalog.lastError}`
                    : ""}
                </p>
              ) : null}

              {adminError ? (
                <p className={styles.adminError} role="alert">
                  {adminError}
                </p>
              ) : null}
              <div className={styles.obsBlock}>
                <p className={styles.adminHint}>
                  OBS overlay for this hunt board (admin only):
                </p>
                <ObsOverlayLink />
              </div>
              <p className={styles.adminHint}>
                Signed in as admin via Kick. Toggle Super or Epic before adding a
                bonus to tag it.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
