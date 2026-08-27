"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import type { BonusHuntState, BonusTier } from "@/lib/bonus-hunt";
import {
  formatBetSize,
  formatBreakEvenLabel,
  formatMultiplier,
  getHuntStats,
  appendSlotRequestToState,
  mergeHuntBoards,
  parseSlotRequestMessage,
  sortBonusesForDisplay,
} from "@/lib/bonus-hunt";
import {
  useKickChatContext,
  useKickChatDemand,
  useKickChatSubscription,
} from "@/hooks/KickChatProvider";
import { useSiteSession } from "@/hooks/useSiteSession";
import { ObsOverlayLink } from "@/components/ObsOverlayLink";
import { useHuntBoard } from "@/components/HuntBoardContext";
import {
  readHuntCache,
} from "@/lib/hunt-client-sync";
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

function huntFingerprint(state: BonusHuntState): string {
  return [
    state.updatedAt,
    state.huntActive ? "1" : "0",
    state.requestsOpen ? "1" : "0",
    state.title,
    String(state.startAmount ?? ""),
    state.bonuses
      .map(
        (bonus) =>
          `${bonus.id}:${bonus.name}:${bonus.betSize ?? ""}:${bonus.winAmount ?? ""}:${bonus.tier}:${bonus.requestedBy ?? ""}`,
      )
      .join("|"),
    state.slotRequests.map((req) => `${req.id}:${req.slotName}`).join("|"),
  ].join("::");
}

function linkHuntLiveFlags(state: BonusHuntState): BonusHuntState {
  const live = state.huntActive || state.requestsOpen;
  if (state.huntActive === live && state.requestsOpen === live) return state;
  return {
    ...state,
    huntActive: live,
    requestsOpen: live,
  };
}

function preferState(
  local: BonusHuntState | null,
  remote: BonusHuntState,
  guardUntil: number,
): BonusHuntState {
  if (!local) return remote;

  const localFp = huntFingerprint(local);
  const remoteFp = huntFingerprint(remote);
  if (localFp === remoteFp) return local;

  const localT = Date.parse(local.updatedAt) || 0;
  const remoteT = Date.parse(remote.updatedAt) || 0;
  const guarded = nowMs() < guardUntil;

  const remoteReset =
    remoteT > 0 &&
    !remote.huntActive &&
    !remote.requestsOpen &&
    remote.bonuses.length === 0 &&
    remote.slotRequests.length === 0 &&
    !remote.title.trim() &&
    remote.startAmount == null;

  // Intentional end/clear must win when it's newer.
  if (remoteReset && remoteT >= localT) return remote;

  // Union merge so a cold instance that only saw the newest bonus can't wipe older rows.
  const merged = linkHuntLiveFlags(mergeHuntBoards(local, remote));

  // While guarded after a local write, keep local flags if remote is older.
  if (guarded && remoteT < localT) {
    return {
      ...merged,
      huntActive: local.huntActive,
      requestsOpen: local.requestsOpen,
      title: local.title.trim() ? local.title : merged.title,
      startAmount: local.startAmount ?? merged.startAmount,
    };
  }

  return merged;
}

function nowMs() {
  return Date.now();
}

async function pushHuntSync(state: BonusHuntState) {
  try {
    await fetch("/api/bonus-hunt/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
  } catch {
    /* ignore */
  }
}

export function ActiveHuntPanel() {
  const { isAdmin, user, ready: sessionReady } = useSiteSession();
  const { publishBoard } = useHuntBoard();
  const { reconnectChat } = useKickChatContext();
  const canManage = Boolean(sessionReady && user && isAdmin);
  const [state, setState] = useState<BonusHuntState | null>(null);
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
  const [lastChatError, setLastChatError] = useState<string | null>(null);
  const guardUntilRef = useRef(0);
  const formFocusedRef = useRef(false);
  const busyRef = useRef(false);
  const fingerprintRef = useRef<string>("");
  const stateRef = useRef<BonusHuntState | null>(null);
  const huntListViewportRef = useRef<HTMLDivElement>(null);
  const huntListMeasureRef = useRef<HTMLDivElement>(null);
  const prevBonusIdsRef = useRef<string[]>([]);
  const [newBonusId, setNewBonusId] = useState<string | null>(null);
  const [huntListScrolling, setHuntListScrolling] = useState(false);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    const list = state?.bonuses ?? [];
    const prevIds = prevBonusIdsRef.current;
    const currentIds = list.map((bonus) => bonus.id);
    const added = currentIds.filter((id) => !prevIds.includes(id));

    if (prevIds.length === 0 && currentIds.length > 0) {
      prevBonusIdsRef.current = currentIds;
      return;
    }

    prevBonusIdsRef.current = currentIds;

    if (added.length === 0) return;

    const latestId = added[added.length - 1] ?? null;
    setNewBonusId(latestId);
    const flashTimer = window.setTimeout(() => setNewBonusId(null), 1600);
    return () => clearTimeout(flashTimer);
  }, [state?.bonuses]);

  // Restore last known board immediately so serverless empties don't flash
  useEffect(() => {
    const cached = readHuntCache();
    if (!cached) return;
    fingerprintRef.current = huntFingerprint(cached);
    guardUntilRef.current = nowMs() + 8_000;
    stateRef.current = cached;
    const frame = window.requestAnimationFrame(() => {
      setState(cached);
      publishBoard(cached);
      setHuntTitle((current) => current || cached.title);
      setStartAmountInput((current) =>
        current
          ? current
          : cached.startAmount != null
            ? String(cached.startAmount)
            : "",
      );
      setWinDrafts((current) => {
        const nextDrafts = { ...current };
        for (const bonus of cached.bonuses) {
          if (nextDrafts[bonus.id] === undefined) {
            nextDrafts[bonus.id] =
              bonus.winAmount != null ? String(bonus.winAmount) : "";
          }
        }
        return nextDrafts;
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [publishBoard]);

  const requestsOpen = state?.requestsOpen ?? false;
  const huntActive = Boolean(state?.huntActive);
  const chatNeeded = huntActive || requestsOpen;

  useKickChatDemand("bonus-hunt", chatNeeded);

  const selectedTier: BonusTier =
    epicTier ? "epic" : superTier ? "super" : "normal";

  const applyRemoteState = useCallback((next: BonusHuntState) => {
    const prev = stateRef.current;
    const merged = linkHuntLiveFlags(
      preferState(prev, next, guardUntilRef.current),
    );
    const fp = huntFingerprint(merged);
    if (fp === fingerprintRef.current) return;

    fingerprintRef.current = fp;
    publishBoard(merged);
    stateRef.current = merged;
    setState(merged);

    // If this browser still has the real board, push it so OBS/API catch up
    if (
      canManage &&
      prev &&
      prev.bonuses.length > next.bonuses.length &&
      merged.bonuses.length > next.bonuses.length &&
      !(!merged.huntActive && merged.bonuses.length === 0)
    ) {
      void pushHuntSync(merged);
    }

    if (!formFocusedRef.current) {
      setHuntTitle(merged.title);
      setStartAmountInput(
        merged.startAmount != null ? String(merged.startAmount) : "",
      );
    }
    setWinDrafts((current) => {
      const copy: Record<string, string> = {};
      let draftsChanged = false;
      for (const bonus of merged.bonuses) {
        const nextVal =
          bonus.winAmount != null ? String(bonus.winAmount) : "";
        const prevVal = current[bonus.id];
        copy[bonus.id] =
          formFocusedRef.current && prevVal !== undefined ? prevVal : nextVal;
        if (copy[bonus.id] !== prevVal) draftsChanged = true;
      }
      if (Object.keys(current).length !== Object.keys(copy).length) {
        draftsChanged = true;
      }
      return draftsChanged ? copy : current;
    });
  }, [canManage, publishBoard]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (formFocusedRef.current || busyRef.current) return;
      try {
        const next = await fetchState();
        if (cancelled) return;
        applyRemoteState(next);
      } catch {
        /* ignore */
      }
    }

    load();
    const timer = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [applyRemoteState]);

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

  const handleChatMessage = useCallback(
    async (message: { username: string; content: string }) => {
      if (!requestsOpen) return;
      const parsed = parseSlotRequestMessage(message.content);
      if (!parsed) return;

      let resolvedName = parsed.slotName;

      try {
        const checkRes = await fetch("/api/bonus-hunt/slots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slotName: parsed.slotName }),
        });
        const check = (await checkRes.json()) as {
          allowed?: boolean;
          reason?: string;
          slot?: { name?: string };
        };
        if (!check.allowed || !check.slot?.name) {
          if (canManage) {
            setLastChatError(
              check.reason ??
                `Could not verify slot "${parsed.slotName}" against Stake`,
            );
          }
          return;
        }
        resolvedName = check.slot.name;
      } catch {
        if (canManage) {
          setLastChatError("Could not verify slot name against Stake");
        }
        return;
      }

      // Streamer tab owns optimistic queue + sync so serverless splits don't drop !s.
      if (canManage && stateRef.current?.requestsOpen) {
        const local = appendSlotRequestToState(
          stateRef.current,
          message.username,
          resolvedName,
        );
        if (local.accepted) {
          setLastChatError(null);
          fingerprintRef.current = huntFingerprint(local.state);
          guardUntilRef.current = nowMs() + 20_000;
          publishBoard(local.state);
          stateRef.current = local.state;
          setState(local.state);
          void pushHuntSync(local.state);
        } else if (local.reason) {
          setLastChatError(local.reason);
        }
      }

      try {
        const res = await fetch("/api/bonus-hunt/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: message.username,
            message: `!s ${resolvedName}`,
          }),
        });
        const data = (await res.json()) as BonusHuntState & {
          error?: string;
          state?: BonusHuntState;
        };
        const board = res.ok
          ? data
          : data.state && Array.isArray(data.state.bonuses)
            ? data.state
            : data.updatedAt && Array.isArray(data.bonuses)
              ? data
              : null;

        if (board) {
          const merged = preferState(
            stateRef.current,
            board,
            guardUntilRef.current,
          );
          fingerprintRef.current = huntFingerprint(merged);
          publishBoard(merged);
          stateRef.current = merged;
          setState(merged);
          if (canManage) void pushHuntSync(merged);
          if (res.ok) setLastChatError(null);
        }

        if (!res.ok && canManage && data.error) {
          if (
            data.error === "Slot requests are closed" &&
            stateRef.current?.requestsOpen
          ) {
            return;
          }
          setLastChatError(data.error);
        }
      } catch {
        if (canManage && !(stateRef.current?.slotRequests.length ?? 0)) {
          setLastChatError("Could not reach server for slot request");
        }
      }
    },
    [requestsOpen, publishBoard, canManage],
  );

  useKickChatSubscription(handleChatMessage, requestsOpen);

  async function adminRequest(
    url: string,
    body?: object,
  ): Promise<BonusHuntState | null> {
    setAdminError(null);
    busyRef.current = true;
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
      const action =
        url.includes("/api/bonus-hunt/admin") && body && "action" in body
          ? (body as { action?: string }).action
          : null;
      const clearing =
        action === "end-hunt" ||
        (url.includes("/api/bonus-hunt/bonus/remove") &&
          body &&
          "all" in body &&
          Boolean((body as { all?: boolean }).all));

      const merged = clearing
        ? next
        : preferState(stateRef.current, next, nowMs() + 20_000);

      guardUntilRef.current = nowMs() + 20_000;
      fingerprintRef.current = huntFingerprint(merged);
      publishBoard(merged);
      stateRef.current = merged;
      setState(merged);
      if (canManage) void pushHuntSync(merged);
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
      if (clearing && action !== "end-hunt") {
        setWinDrafts({});
        setSelectedRequestId(null);
      }
      return merged;
    } catch {
      setAdminError("Could not reach server");
      return null;
    } finally {
      busyRef.current = false;
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

    const requestId =
      selectedRequestId &&
      (stateRef.current?.slotRequests ?? []).some(
        (req) => req.id === selectedRequestId,
      )
        ? selectedRequestId
        : null;

    if (requestId) {
      const next = await adminRequest("/api/bonus-hunt/admin", {
        action: "promote-request",
        id: requestId,
        betSize,
        winAmount,
        tier: selectedTier,
        board: stateRef.current ?? undefined,
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
      board: stateRef.current ?? undefined,
    });
    if (next) {
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
  const huntLabel = state?.title?.trim() || "—";
  const breakEvenLabel = stats ? formatBreakEvenLabel(stats) : "—";
  const activeSelectedRequestId =
    selectedRequestId &&
    slotRequests.some((req) => req.id === selectedRequestId)
      ? selectedRequestId
      : null;
  const huntListDurationSec = Math.max(14, bonuses.length * 2.4);

  useEffect(() => {
    const viewport = huntListViewportRef.current;
    const measure = huntListMeasureRef.current;
    if (!viewport || !measure || bonuses.length === 0) {
      setHuntListScrolling(false);
      return;
    }

    function update() {
      if (!viewport || !measure) return;
      setHuntListScrolling(measure.scrollHeight > viewport.clientHeight + 4);
    }

    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [bonuses]);

  async function saveStartAmount() {
    await adminRequest("/api/bonus-hunt/admin", {
      action: "set-start-amount",
      startAmount: startAmountInput,
      board: stateRef.current ?? undefined,
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

  async function setHuntLive(live: boolean) {
    const currentlyLive = Boolean(state?.huntActive) && requestsOpen;
    if (currentlyLive === live) {
      // Still force sync if one side drifted.
      if (Boolean(state?.huntActive) === live && requestsOpen === live) return;
    }

    // Optimistic UI: keep both toggles locked together immediately.
    if (stateRef.current) {
      const nextLocal: BonusHuntState = {
        ...stateRef.current,
        huntActive: live,
        requestsOpen: live,
        updatedAt: new Date().toISOString(),
      };
      if (live) {
        nextLocal.startedAt =
          nextLocal.startedAt ?? new Date().toISOString();
      }
      fingerprintRef.current = huntFingerprint(nextLocal);
      guardUntilRef.current = nowMs() + 20_000;
      stateRef.current = nextLocal;
      setState(nextLocal);
      publishBoard(nextLocal);
    }

    const next = await adminRequest("/api/bonus-hunt/admin", {
      action: "set-active",
      active: live,
    });
    if (next && live) {
      void reconnectChat();
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.statusRow}>
        {canManage ? (
          <>
            <div
              className={styles.huntStatusGroup}
              role="group"
              aria-label="Hunt status"
            >
              <button
                type="button"
                className={`${styles.huntStatusToggle} ${styles.huntIdle}`}
                aria-pressed={!huntActive}
                data-active={!huntActive || undefined}
                disabled={busy}
                onClick={() => void setHuntLive(false)}
              >
                Idle
              </button>
              <button
                type="button"
                className={`${styles.huntStatusToggle} ${styles.huntActiveBtn}`}
                aria-pressed={huntActive}
                data-active={huntActive || undefined}
                disabled={busy}
                onClick={() => void setHuntLive(true)}
              >
                Active
              </button>
            </div>
            <div
              className={styles.huntStatusGroup}
              role="group"
              aria-label="Slot requests"
            >
              <button
                type="button"
                className={`${styles.huntStatusToggle} ${styles.huntIdle}`}
                aria-pressed={!requestsOpen}
                data-active={!requestsOpen || undefined}
                disabled={busy}
                onClick={() => void setHuntLive(false)}
              >
                Requests closed
              </button>
              <button
                type="button"
                className={`${styles.huntStatusToggle} ${styles.huntActiveBtn}`}
                aria-pressed={requestsOpen}
                data-active={requestsOpen || undefined}
                disabled={busy}
                onClick={() => void setHuntLive(true)}
              >
                Requests open
              </button>
            </div>
          </>
        ) : (
          <>
            <span
              className={`${styles.statusBadge} ${huntActive ? styles.statusOpen : styles.statusClosed}`}
            >
              {huntActive ? "Hunt active" : "Hunt idle"}
            </span>
            <span
              className={`${styles.statusBadge} ${requestsOpen ? styles.statusOpen : styles.statusClosed}`}
            >
              {requestsOpen ? "Slot requests open" : "Slot requests closed"}
            </span>
          </>
        )}
      </div>

      {canManage && lastChatError ? (
        <p className={styles.chatError} role="status">
          {lastChatError}
        </p>
      ) : null}

      {canManage ? (
        <label className={styles.huntNumberLabel} htmlFor="hunt-number-input">
          <span className={styles.srOnly}>Hunt number</span>
          <input
            id="hunt-number-input"
            className={styles.huntNumberInput}
            type="text"
            value={huntTitle}
            onFocus={() => {
              formFocusedRef.current = true;
            }}
            onBlur={() => {
              formFocusedRef.current = false;
              const next = huntTitle.trim();
              if (next === (stateRef.current?.title ?? "").trim()) return;
              void adminRequest("/api/bonus-hunt/admin", {
                action: "set-title",
                title: next,
              });
            }}
            onChange={(e) => setHuntTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            placeholder="Hunt #1"
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
            aria-label="Hunt number"
          />
        </label>
      ) : state?.title?.trim() ? (
        <p className={styles.huntTitle}>{state.title}</p>
      ) : null}

      <section className={styles.block} aria-label="Hunt bankroll">
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
                  onFocus={() => {
                    formFocusedRef.current = true;
                  }}
                  onBlur={() => {
                    formFocusedRef.current = false;
                  }}
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
                  : stats?.startAmount != null && stats.totalBet > 0
                    ? `${formatBetSize(stats.startAmount)} ÷ ${formatBetSize(stats.totalBet)} total bet`
                    : stats?.startAmount == null
                      ? "Save a start amount to calculate break-even"
                      : stats?.totalBet === 0
                        ? "Add bet sizes on bonuses to calculate break-even"
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
                const selected = activeSelectedRequestId === req.id;
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
          onFocusCapture={() => {
            formFocusedRef.current = true;
          }}
          onBlurCapture={(event) => {
            if (
              !event.currentTarget.contains(
                event.relatedTarget as Node | null,
              )
            ) {
              formFocusedRef.current = false;
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
            {activeSelectedRequestId ? "Add selected to list" : "Add to list"}
          </button>
        </form>
        ) : null}

        <div
          className={styles.subBlock}
          onFocusCapture={() => {
            formFocusedRef.current = true;
          }}
          onBlurCapture={(event) => {
            if (
              !event.currentTarget.contains(
                event.relatedTarget as Node | null,
              )
            ) {
              formFocusedRef.current = false;
            }
          }}
        >
          <div className={styles.subHeader}>
            <h4 className={styles.subTitle}>Hunt list</h4>
            <span className={styles.subCount}>{bonuses.length}</span>
          </div>
          {bonuses.length === 0 ? (
            <p className={styles.empty}>No bonuses on the list yet.</p>
          ) : (
            <div className={styles.tableShell}>
              <table className={`${styles.table} ${styles.tableHeadTable}`}>
                <thead>
                  <tr>
                    <th scope="col" className={styles.colHunt}>
                      Hunt #
                    </th>
                    <th scope="col" className={styles.colBreakEven}>
                      Break even x
                    </th>
                    <th scope="col" className={styles.colName}>
                      Slot name
                    </th>
                    <th scope="col" className={styles.colBet}>
                      Bet size
                    </th>
                    <th scope="col" className={styles.colWin}>
                      Win amount
                    </th>
                    {canManage ? (
                      <th scope="col" className={styles.colAction}>
                        <span className={styles.srOnly}>Remove</span>
                      </th>
                    ) : null}
                  </tr>
                </thead>
              </table>
              <div
                ref={huntListViewportRef}
                className={styles.tableViewport}
                data-scrolling={huntListScrolling || undefined}
              >
                <div
                  className={styles.tableTrack}
                  data-scrolling={huntListScrolling || undefined}
                  style={
                    huntListScrolling
                      ? ({
                          "--scroll-duration": `${huntListDurationSec}s`,
                        } as CSSProperties)
                      : undefined
                  }
                >
                  <div ref={huntListMeasureRef}>
                    <table className={styles.table}>
                      <tbody>
                        {bonuses.map((bonus) => (
                          <tr
                            key={bonus.id}
                            data-tier={
                              bonus.tier !== "normal" ? bonus.tier : undefined
                            }
                            data-new={bonus.id === newBonusId || undefined}
                          >
                            <td className={styles.colHunt}>{huntLabel}</td>
                            <td className={styles.colBreakEven}>
                              {breakEvenLabel}
                            </td>
                            <td className={styles.colName}>
                              <span className={styles.bonusName}>
                                {bonus.name}
                              </span>
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
                            {canManage ? (
                              <td className={styles.colAction}>
                                <button
                                  type="button"
                                  className={styles.removeBtn}
                                  disabled={busy}
                                  onClick={() =>
                                    adminRequest(
                                      "/api/bonus-hunt/bonus/remove",
                                      {
                                        id: bonus.id,
                                        board: stateRef.current ?? undefined,
                                      },
                                    )
                                  }
                                  aria-label={`Remove ${bonus.name}`}
                                >
                                  ×
                                </button>
                              </td>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {huntListScrolling ? (
                    <table className={styles.table} aria-hidden>
                      <tbody>
                        {bonuses.map((bonus) => (
                          <tr
                            key={`loop-${bonus.id}`}
                            data-tier={
                              bonus.tier !== "normal" ? bonus.tier : undefined
                            }
                          >
                            <td className={styles.colHunt}>{huntLabel}</td>
                            <td className={styles.colBreakEven}>
                              {breakEvenLabel}
                            </td>
                            <td className={styles.colName}>
                              <span className={styles.bonusName}>
                                {bonus.name}
                              </span>
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
                              {formatBetSize(bonus.winAmount)}
                            </td>
                            {canManage ? (
                              <td className={styles.colAction} />
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : null}
                </div>
              </div>
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
              <div className={styles.adminActions}>
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
                  disabled={
                    busy ||
                    !(
                      state?.huntActive ||
                      (state?.bonuses.length ?? 0) > 0 ||
                      state?.startAmount != null ||
                      Boolean(state?.title?.trim())
                    )
                  }
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
                    : " · auto every 5m when stale"}
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
                Signed in as admin via Kick. Use the Idle/Active and Requests
                toggles above to run the hunt. Toggle Super or Epic before
                adding a bonus to append (Super) or (Epic) to the slot name.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
