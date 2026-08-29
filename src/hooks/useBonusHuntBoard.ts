"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { BonusHuntState, BonusTier, PastHuntResult } from "@/lib/bonus-hunt";
import {
  formatBreakEvenLabel,
  getHuntStats,
  appendSlotRequestToState,
  buildPastHuntArchive,
  createIntentionalResetBoard,
  mergeHuntBoards,
  nextBoardEpoch,
  parseMoneyAmount,
  parseSlotRequestMessage,
  remoteLooksLikeNewHunt,
  sortBonusesForDisplay,
} from "@/lib/bonus-hunt";
import {
  useKickChatContext,
  useKickChatDemand,
  useKickChatSubscription,
} from "@/hooks/KickChatProvider";
import { useSiteSession } from "@/hooks/useSiteSession";
import { useHuntBoard } from "@/components/HuntBoardContext";
import {
  HUNT_HISTORY_EVENT,
  isIntentionalReset,
  preferPastHunts,
  readHuntCache,
  readHuntHistoryCache,
  writeHuntHistoryCache,
} from "@/lib/hunt-client-sync";

export type SlotCatalogSummary = {
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

  const localReset = isIntentionalReset(local);

  if (localReset && !remoteLooksLikeNewHunt(local, remote)) return local;

  if (remoteReset && remoteT >= localT) return remote;

  const merged = linkHuntLiveFlags(mergeHuntBoards(local, remote));

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

async function pushHistorySync(hunts: PastHuntResult[]) {
  try {
    await fetch("/api/bonus-hunt/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync-history", hunts }),
    });
  } catch {
    /* ignore */
  }
}

export function useBonusHuntBoard() {
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
  const prevBonusIdsRef = useRef<string[]>([]);
  const [newBonusId, setNewBonusId] = useState<string | null>(null);

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

  useEffect(() => {
    const cached = readHuntCache();
    if (!cached) return;
    fingerprintRef.current = huntFingerprint(cached);
    guardUntilRef.current =
      nowMs() + (isIntentionalReset(cached) ? 60_000 : 8_000);
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
      let resolvedThumbnail: string | null = null;

      try {
        const checkRes = await fetch("/api/bonus-hunt/slots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slotName: parsed.slotName }),
        });
        const check = (await checkRes.json()) as {
          allowed?: boolean;
          reason?: string;
          slot?: { name?: string; thumbnailUrl?: string | null };
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
        resolvedThumbnail = check.slot.thumbnailUrl ?? null;
      } catch {
        if (canManage) {
          setLastChatError("Could not verify slot name against Stake");
        }
        return;
      }

      if (canManage && stateRef.current?.requestsOpen) {
        const local = appendSlotRequestToState(
          stateRef.current,
          message.username,
          resolvedName,
          resolvedThumbnail,
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
        return;
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

      const nextRaw = (await res.json()) as BonusHuntState & {
        archived?: PastHuntResult | null;
        hunts?: PastHuntResult[];
      };
      const action =
        url.includes("/api/bonus-hunt/admin") && body && "action" in body
          ? (body as { action?: string }).action
          : null;
      const preEndBoard =
        action === "end-hunt" && body && "board" in body
          ? ((body as { board?: BonusHuntState | null }).board ?? null)
          : action === "end-hunt"
            ? stateRef.current
            : null;
      const { archived, hunts, ...boardPayload } = nextRaw;
      const next = boardPayload as BonusHuntState;
      const clearing =
        action === "end-hunt" ||
        (url.includes("/api/bonus-hunt/bonus/remove") &&
          body &&
          "all" in body &&
          Boolean((body as { all?: boolean }).all));

      const merged = clearing
        ? isIntentionalReset(next)
          ? next
          : createIntentionalResetBoard(nextBoardEpoch(preEndBoard))
        : preferState(stateRef.current, next, nowMs() + 20_000);

      guardUntilRef.current = nowMs() + 20_000;
      fingerprintRef.current = huntFingerprint(merged);
      publishBoard(merged);
      stateRef.current = merged;
      setState(merged);
      if (canManage) void pushHuntSync(merged);
      if (action === "end-hunt") {
        guardUntilRef.current = nowMs() + 60_000;
        let archivedHunt = archived ?? null;
        if (!archivedHunt && preEndBoard) {
          archivedHunt = buildPastHuntArchive(preEndBoard);
        }
        const mergedHunts = preferPastHunts(
          readHuntHistoryCache(),
          Array.isArray(hunts) ? hunts : [],
        );
        const withArchive = archivedHunt
          ? preferPastHunts(mergedHunts, [archivedHunt])
          : mergedHunts;
        writeHuntHistoryCache(withArchive);
        if (canManage) void pushHistorySync(withArchive);

        setWinDrafts({});
        setSelectedRequestId(null);
        setBonusName("");
        setBetSize("");
        setWinAmount("");
        setHuntTitle("");
        setStartAmountInput("");
        window.dispatchEvent(new Event(HUNT_HISTORY_EVENT));
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
      requestId,
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
  const typedStartAmount = parseMoneyAmount(startAmountInput);
  const stats = state
    ? getHuntStats({
        ...state,
        startAmount: state.startAmount ?? typedStartAmount,
      })
    : null;
  const breakEvenLabel = stats ? formatBreakEvenLabel(stats) : "—";
  const activeSelectedRequestId =
    selectedRequestId &&
    slotRequests.some((req) => req.id === selectedRequestId)
      ? selectedRequestId
      : null;

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
      board: stateRef.current ?? undefined,
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
      if (Boolean(state?.huntActive) === live && requestsOpen === live) return;
    }

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

  async function endHunt() {
    const archiveBoard = stateRef.current;
    const optimistic = createIntentionalResetBoard(nextBoardEpoch(archiveBoard));

    fingerprintRef.current = huntFingerprint(optimistic);
    guardUntilRef.current = nowMs() + 60_000;
    stateRef.current = optimistic;
    setState(optimistic);
    publishBoard(optimistic);
    setWinDrafts({});
    setSelectedRequestId(null);
    setBonusName("");
    setBetSize("");
    setWinAmount("");
    setHuntTitle("");
    setStartAmountInput("");

    const result = await adminRequest("/api/bonus-hunt/admin", {
      action: "end-hunt",
      board: archiveBoard ?? undefined,
    });

    if (result) {
      void pushHuntSync(result);
    } else if (archiveBoard) {
      fingerprintRef.current = huntFingerprint(archiveBoard);
      guardUntilRef.current = nowMs() + 20_000;
      stateRef.current = archiveBoard;
      setState(archiveBoard);
      publishBoard(archiveBoard);
      setHuntTitle(archiveBoard.title);
      setStartAmountInput(
        archiveBoard.startAmount != null
          ? String(archiveBoard.startAmount)
          : "",
      );
      setWinDrafts((current) => {
        const nextDrafts = { ...current };
        for (const bonus of archiveBoard.bonuses) {
          if (nextDrafts[bonus.id] === undefined) {
            nextDrafts[bonus.id] =
              bonus.winAmount != null ? String(bonus.winAmount) : "";
          }
        }
        return nextDrafts;
      });
    }
  }

  return {
    canManage,
    busy,
    adminError,
    lastChatError,
    showAdmin,
    setShowAdmin,
    state,
    huntActive,
    requestsOpen,
    huntTitle,
    setHuntTitle,
    startAmountInput,
    setStartAmountInput,
    bonuses,
    slotRequests,
    stats,
    breakEvenLabel,
    winDrafts,
    setWinDrafts,
    bonusName,
    setBonusName,
    betSize,
    setBetSize,
    winAmount,
    setWinAmount,
    superTier,
    epicTier,
    toggleSuper,
    toggleEpic,
    selectedTier,
    selectedRequestId,
    setSelectedRequestId,
    activeSelectedRequestId,
    selectRequest,
    newBonusId,
    slotCatalog,
    formFocusedRef,
    stateRef,
    adminRequest,
    handleAddBonus,
    saveStartAmount,
    saveWinAmount,
    setHuntLive,
    endHunt,
    refreshSlotCatalog,
  };
}
