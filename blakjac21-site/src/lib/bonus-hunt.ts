export type BonusTier = "normal" | "super" | "epic";

export type BonusItem = {
  id: string;
  name: string;
  betSize: number | null;
  winAmount: number | null;
  tier: BonusTier;
  /** Kick username that requested this slot via !s, if any */
  requestedBy: string | null;
  createdAt: string;
};

export type SlotRequest = {
  id: string;
  username: string;
  slotName: string;
  createdAt: string;
};

export type BonusHuntStats = {
  startAmount: number | null;
  totalBet: number;
  totalWins: number;
  remainingToRecover: number | null;
  remainingBet: number;
  openedCount: number;
  remainingCount: number;
  avgXOpened: number | null;
  breakEvenX: number | null;
  breakEvenReached: boolean;
};

export type BonusHuntState = {
  huntActive: boolean;
  requestsOpen: boolean;
  title: string;
  startAmount: number | null;
  bonuses: BonusItem[];
  slotRequests: SlotRequest[];
  startedAt: string | null;
  updatedAt: string;
};

export type PastHuntResult = {
  id: string;
  title: string;
  startAmount: number | null;
  bonuses: BonusItem[];
  stats: BonusHuntStats;
  startedAt: string | null;
  endedAt: string;
};

type StoreGlobal = typeof globalThis & {
  __bonusHuntState?: BonusHuntState;
  __bonusHuntHistory?: PastHuntResult[];
  __bonusHuntLoaded?: boolean;
};

const MAX_PAST_HUNTS = 50;
const STATE_FILE = "bonus-hunt-state.json";
const HISTORY_FILE = "bonus-hunt-history.json";

function createState(): BonusHuntState {
  return {
    huntActive: false,
    requestsOpen: false,
    title: "",
    startAmount: null,
    bonuses: [],
    slotRequests: [],
    startedAt: null,
    // Epoch so empty cold instances lose to real persisted/mutated state
    updatedAt: new Date(0).toISOString(),
  };
}

function normalizeState(state: BonusHuntState): BonusHuntState {
  if (state.startAmount === undefined) state.startAmount = null;
  if (state.startedAt === undefined) state.startedAt = null;
  state.bonuses = (state.bonuses ?? []).map((bonus) => ({
    ...bonus,
    winAmount: bonus.winAmount ?? null,
    requestedBy: bonus.requestedBy ?? null,
    tier: bonus.tier ?? "normal",
  }));
  state.slotRequests = (state.slotRequests ?? []).map((req) => ({
    ...req,
    slotName: req.slotName?.trim() || "—",
  }));
  if (!state.updatedAt) state.updatedAt = new Date(0).toISOString();
  return state;
}

function persistState(state: BonusHuntState) {
  if (typeof window !== "undefined") return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { writeJsonFile } = require("@/lib/json-store") as typeof import("@/lib/json-store");
    writeJsonFile(STATE_FILE, state);
  } catch {
    /* ignore */
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { writeRemoteJson } =
      require("@/lib/remote-json-store") as typeof import("@/lib/remote-json-store");
    const snapshot = state;
    pendingRemoteWrite = pendingRemoteWrite
      .catch(() => undefined)
      .then(() => writeRemoteJson(STATE_FILE, snapshot))
      .then(() => undefined);
  } catch {
    /* ignore */
  }
}

function persistHistory(history: PastHuntResult[]) {
  if (typeof window !== "undefined") return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { writeJsonFile } = require("@/lib/json-store") as typeof import("@/lib/json-store");
    writeJsonFile(HISTORY_FILE, history);
  } catch {
    /* ignore */
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { writeRemoteJson } =
      require("@/lib/remote-json-store") as typeof import("@/lib/remote-json-store");
    const snapshot = history;
    pendingRemoteWrite = pendingRemoteWrite
      .catch(() => undefined)
      .then(() => writeRemoteJson(HISTORY_FILE, snapshot))
      .then(() => undefined);
  } catch {
    /* ignore */
  }
}

let pendingRemoteWrite: Promise<void> = Promise.resolve();

export async function flushBonusHuntPersist(): Promise<void> {
  await pendingRemoteWrite;
}

function richerState(
  local: BonusHuntState | undefined,
  remote: BonusHuntState,
): BonusHuntState {
  if (!local) return normalizeState(remote);
  return mergeHuntBoards(local, remote);
}

/** Union bonuses/requests from two boards so cold instances can't wipe rows. */
export function mergeHuntBoards(
  local: BonusHuntState,
  remote: BonusHuntState,
): BonusHuntState {
  const localT = Date.parse(local.updatedAt) || 0;
  const remoteT = Date.parse(remote.updatedAt) || 0;

  const remoteReset =
    remoteT > 0 &&
    !remote.huntActive &&
    !remote.requestsOpen &&
    remote.bonuses.length === 0 &&
    remote.slotRequests.length === 0 &&
    !remote.title.trim() &&
    remote.startAmount == null;
  const localReset =
    localT > 0 &&
    !local.huntActive &&
    !local.requestsOpen &&
    local.bonuses.length === 0 &&
    local.slotRequests.length === 0 &&
    !local.title.trim() &&
    local.startAmount == null;

  if (remoteReset && remoteT >= localT) return normalizeState(remote);
  if (localReset && localT > remoteT) return normalizeState(local);

  const bonusById = new Map<string, BonusItem>();
  for (const bonus of local.bonuses) bonusById.set(bonus.id, bonus);
  for (const bonus of remote.bonuses) bonusById.set(bonus.id, bonus);

  const requestById = new Map<string, SlotRequest>();
  for (const req of local.slotRequests) requestById.set(req.id, req);
  for (const req of remote.slotRequests) requestById.set(req.id, req);

  const newer = remoteT >= localT ? remote : local;
  const older = newer === remote ? local : remote;

  return normalizeState({
    ...newer,
    title: newer.title.trim() || older.title,
    startAmount: newer.startAmount ?? older.startAmount,
    startedAt: newer.startedAt ?? older.startedAt,
    huntActive: newer.huntActive,
    requestsOpen: newer.requestsOpen,
    bonuses: [...bonusById.values()].sort(
      (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
    ),
    slotRequests: [...requestById.values()].sort(
      (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
    ),
    updatedAt: new Date(Math.max(localT, remoteT, Date.now())).toISOString(),
  });
}

/** Seed this instance from a trusted client board before mutating. */
export function seedBonusHuntFromClient(
  incoming: BonusHuntState | null | undefined,
): BonusHuntState {
  ensureLoaded();
  if (!incoming || !Array.isArray(incoming.bonuses)) {
    return getBonusHuntState();
  }
  const current = getBonusHuntState();
  const merged = mergeHuntBoards(current, normalizeState(incoming));
  const g = globalThis as StoreGlobal;
  g.__bonusHuntState = merged;
  persistState(merged);
  return merged;
}

/** Pull shared remote state (Upstash) into this instance before serving GETs. */
export async function hydrateBonusHuntFromRemote(): Promise<BonusHuntState> {
  ensureLoaded();
  const g = globalThis as StoreGlobal;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readRemoteJson } =
      require("@/lib/remote-json-store") as typeof import("@/lib/remote-json-store");
    const remote = await readRemoteJson<BonusHuntState>(STATE_FILE);
    if (remote && typeof remote === "object") {
      g.__bonusHuntState = richerState(g.__bonusHuntState, remote);
    }
    const history = await readRemoteJson<PastHuntResult[]>(HISTORY_FILE);
    if (Array.isArray(history)) {
      const local = g.__bonusHuntHistory ?? [];
      // Prefer the set that contains all of the other's ids, else the newer/longer archive.
      const localIds = new Set(local.map((h) => h.id));
      const remoteIds = new Set(history.map((h) => h.id));
      const remoteHasAllLocal = [...localIds].every((id) => remoteIds.has(id));
      const localHasAllRemote = [...remoteIds].every((id) => localIds.has(id));
      if (remoteHasAllLocal && history.length >= local.length) {
        g.__bonusHuntHistory = history;
      } else if (localHasAllRemote && local.length > history.length) {
        g.__bonusHuntHistory = local;
      } else if (history.length >= local.length) {
        g.__bonusHuntHistory = history;
      } else {
        g.__bonusHuntHistory = local;
      }
    }
  } catch {
    /* keep local */
  }
  return getBonusHuntState();
}

function ensureLoaded() {
  const g = globalThis as StoreGlobal;
  if (g.__bonusHuntLoaded) return;
  g.__bonusHuntLoaded = true;
  if (typeof window !== "undefined") return;

  try {
    // Sync read on server so the first request sees persisted state.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readJsonFile } = require("@/lib/json-store") as typeof import("@/lib/json-store");
    const saved = readJsonFile<BonusHuntState>(STATE_FILE);
    if (saved && typeof saved === "object") {
      g.__bonusHuntState = normalizeState({ ...createState(), ...saved });
    }
    const history = readJsonFile<PastHuntResult[]>(HISTORY_FILE);
    if (Array.isArray(history)) {
      g.__bonusHuntHistory = history;
    }
  } catch {
    /* keep memory defaults */
  }
}

export function getBonusHuntState(): BonusHuntState {
  ensureLoaded();
  const g = globalThis as StoreGlobal;
  if (!g.__bonusHuntState) g.__bonusHuntState = createState();
  return normalizeState(g.__bonusHuntState);
}

/** Replace in-memory board with a client/admin snapshot (keeps provided updatedAt). */
export function replaceBonusHuntState(incoming: BonusHuntState): BonusHuntState {
  ensureLoaded();
  const g = globalThis as StoreGlobal;
  const next = normalizeState({
    ...createState(),
    ...incoming,
    bonuses: Array.isArray(incoming.bonuses) ? incoming.bonuses : [],
    slotRequests: Array.isArray(incoming.slotRequests)
      ? incoming.slotRequests
      : [],
  });
  if (!next.updatedAt) next.updatedAt = new Date().toISOString();
  g.__bonusHuntState = next;
  persistState(next);
  return next;
}

export function getPastHunts(): PastHuntResult[] {
  ensureLoaded();
  const g = globalThis as StoreGlobal;
  if (!g.__bonusHuntHistory) g.__bonusHuntHistory = [];
  return g.__bonusHuntHistory;
}

function touch(state: BonusHuntState): BonusHuntState {
  state.updatedAt = new Date().toISOString();
  persistState(state);
  return state;
}

function markHuntStarted(state: BonusHuntState) {
  if (!state.startedAt) {
    state.startedAt = new Date().toISOString();
  }
}

export function setHuntActive(active: boolean): BonusHuntState {
  const state = getBonusHuntState();
  state.huntActive = active;
  if (active) {
    // Turning hunt Active also opens slot requests so !s starts immediately.
    state.requestsOpen = true;
    markHuntStarted(state);
  } else {
    state.requestsOpen = false;
  }
  return touch(state);
}

/** Archive the current hunt into past results and reset the active board. */
export function endAndArchiveHunt(): {
  accepted: boolean;
  reason?: string;
  state: BonusHuntState;
  archived: PastHuntResult | null;
} {
  const state = getBonusHuntState();
  const hasContent =
    state.bonuses.length > 0 ||
    state.startAmount != null ||
    Boolean(state.title.trim());

  let archived: PastHuntResult | null = null;

  if (hasContent) {
    const history = getPastHunts();
    archived = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: state.title.trim() || "Untitled hunt",
      startAmount: state.startAmount,
      bonuses: state.bonuses.map((bonus) => ({ ...bonus })),
      stats: getHuntStats(state),
      startedAt: state.startedAt,
      endedAt: new Date().toISOString(),
    };
    history.unshift(archived);
    if (history.length > MAX_PAST_HUNTS) {
      history.length = MAX_PAST_HUNTS;
    }
  }

  const g = globalThis as StoreGlobal;
  const reset = createState();
  reset.updatedAt = new Date().toISOString();
  g.__bonusHuntState = reset;
  persistState(reset);
  persistHistory(getPastHunts());
  return { accepted: true, state: reset, archived };
}

export function getPastHunt(id: string): PastHuntResult | null {
  return getPastHunts().find((hunt) => hunt.id === id) ?? null;
}

export function clearPastHunts(): PastHuntResult[] {
  const g = globalThis as StoreGlobal;
  g.__bonusHuntHistory = [];
  persistHistory(g.__bonusHuntHistory);
  return g.__bonusHuntHistory;
}

export function removePastHunt(id: string): {
  removed: boolean;
  hunts: PastHuntResult[];
} {
  const history = getPastHunts();
  const before = history.length;
  const next = history.filter((hunt) => hunt.id !== id);
  const g = globalThis as StoreGlobal;
  g.__bonusHuntHistory = next;
  persistHistory(next);
  return { removed: next.length < before, hunts: next };
}

export function setHuntTitle(title: string): BonusHuntState {
  const state = getBonusHuntState();
  state.title = title.trim();
  // Title-only edit — do not flip Active / Requests open.
  return touch(state);
}

export function setStartAmount(
  value: string | number | null | undefined,
): {
  accepted: boolean;
  reason?: string;
  state: BonusHuntState;
} {
  const state = getBonusHuntState();
  const hasInput = value != null && String(value).trim() !== "";

  if (!hasInput) {
    state.startAmount = null;
    return { accepted: true, state: touch(state) };
  }

  const amount = parseMoneyAmount(value, { allowZero: false });
  if (amount == null) {
    return { accepted: false, reason: "Enter a valid start amount", state };
  }

  state.startAmount = amount;
  state.huntActive = true;
  markHuntStarted(state);
  return { accepted: true, state: touch(state) };
}

export function setRequestsOpen(open: boolean): BonusHuntState {
  const state = getBonusHuntState();
  state.requestsOpen = open;
  // Keep Active and Requests open linked together.
  state.huntActive = open;
  if (open) {
    markHuntStarted(state);
  }
  return touch(state);
}

export function parseMoneyAmount(
  value: string | number | null | undefined,
  options?: { allowZero?: boolean },
): number | null {
  const allowZero = options?.allowZero ?? false;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    if (value < 0) return null;
    if (value === 0) return allowZero ? 0 : null;
    if (value > 999_999_999) return null;
    return Math.round(value * 100) / 100;
  }

  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/[$,\s]/g, "");
  if (!normalized) return null;
  // Allow 10, 10.5, 0.01, and shorthand .01 / .5
  if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(normalized)) return null;

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0 || amount > 999_999_999) return null;
  if (amount === 0) return allowZero ? 0 : null;
  return Math.round(amount * 100) / 100;
}

export const MIN_BET_SIZE = 0.01;
export const MAX_BET_SIZE = 1000;

export function parseBetSize(value: string | number | null | undefined): number | null {
  const amount = parseMoneyAmount(value, { allowZero: false });
  if (amount == null) return null;
  if (amount < MIN_BET_SIZE || amount > MAX_BET_SIZE) return null;
  return amount;
}

export function formatBetSize(amount: number | null): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatMultiplier(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value === 0) return "0.00x";
  return `${value.toFixed(2)}x`;
}

export function formatBreakEvenLabel(stats: BonusHuntStats): string {
  if (stats.breakEvenReached) return "Break-even hit";
  if (stats.breakEvenX == null) return "—";
  return formatMultiplier(stats.breakEvenX);
}

export function getBonusMultiplier(bonus: BonusItem): number | null {
  if (bonus.betSize == null || bonus.betSize <= 0) return null;
  if (bonus.winAmount == null) return null;
  return Math.round((bonus.winAmount / bonus.betSize) * 100) / 100;
}

const TIER_DISPLAY_ORDER: Record<BonusTier, number> = {
  normal: 0,
  super: 1,
  epic: 2,
};

/** Normal bonuses first, then supers, epics last — stable within each tier. */
export function sortBonusesForDisplay(bonuses: BonusItem[]): BonusItem[] {
  return bonuses
    .map((bonus, index) => ({ bonus, index }))
    .sort((a, b) => {
      const tierDiff =
        TIER_DISPLAY_ORDER[a.bonus.tier] - TIER_DISPLAY_ORDER[b.bonus.tier];
      if (tierDiff !== 0) return tierDiff;
      return a.index - b.index;
    })
    .map(({ bonus }) => bonus);
}

export function getHuntStats(state: BonusHuntState): BonusHuntStats {
  const totalBet = state.bonuses.reduce((sum, bonus) => {
    return bonus.betSize != null && bonus.betSize > 0 ? sum + bonus.betSize : sum;
  }, 0);

  const openedBonuses = state.bonuses.filter(
    (bonus) => bonus.winAmount != null && bonus.betSize != null && bonus.betSize > 0,
  );
  const remainingBonuses = state.bonuses.filter(
    (bonus) =>
      bonus.winAmount == null && bonus.betSize != null && bonus.betSize > 0,
  );

  const totalWins = state.bonuses.reduce((sum, bonus) => {
    return bonus.winAmount != null ? sum + bonus.winAmount : sum;
  }, 0);

  const remainingBet = remainingBonuses.reduce((sum, bonus) => {
    return sum + (bonus.betSize ?? 0);
  }, 0);

  const openedMultipliers = openedBonuses
    .map((bonus) => getBonusMultiplier(bonus))
    .filter((value): value is number => value != null);

  const avgXOpened =
    openedMultipliers.length > 0
      ? Math.round(
          (openedMultipliers.reduce((sum, value) => sum + value, 0) /
            openedMultipliers.length) *
            100,
        ) / 100
      : null;

  const remainingToRecover =
    state.startAmount != null && state.startAmount > 0
      ? Math.round(Math.max(0, state.startAmount - totalWins) * 100) / 100
      : null;

  const breakEvenReached =
    state.startAmount != null &&
    state.startAmount > 0 &&
    totalWins >= state.startAmount;

  // Needed average x on remaining unopened bonuses to recover start bankroll.
  let breakEvenX: number | null = null;
  if (state.startAmount != null && state.startAmount > 0) {
    if (breakEvenReached) {
      breakEvenX = 0;
    } else if (remainingBet > 0 && remainingToRecover != null) {
      breakEvenX =
        Math.round((remainingToRecover / remainingBet) * 100) / 100;
    } else if (totalBet > 0 && openedBonuses.length === 0) {
      // No wins logged yet — classic full-list break-even.
      breakEvenX = Math.round((state.startAmount / totalBet) * 100) / 100;
    }
  }

  return {
    startAmount: state.startAmount,
    totalBet,
    totalWins,
    remainingToRecover,
    remainingBet,
    openedCount: openedBonuses.length,
    remainingCount: remainingBonuses.length,
    avgXOpened,
    breakEvenX,
    breakEvenReached,
  };
}

export function formatBonusNameWithTier(
  name: string,
  tier: BonusTier,
): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;
  // Avoid doubling if the name already ends with (Super) / (Epic)
  const withoutSuffix = trimmed
    .replace(/\s*\((?:super|epic)\)\s*$/i, "")
    .trim();
  if (tier === "super") return `${withoutSuffix} (Super)`;
  if (tier === "epic") return `${withoutSuffix} (Epic)`;
  return withoutSuffix;
}

export function addBonus(input: {
  name: string;
  betSize?: string | number | null;
  winAmount?: string | number | null;
  tier?: BonusTier;
  requestedBy?: string | null;
}): {
  accepted: boolean;
  reason?: string;
  state: BonusHuntState;
} {
  const state = getBonusHuntState();
  const tier: BonusTier =
    input.tier === "super" || input.tier === "epic" ? input.tier : "normal";
  const trimmed = formatBonusNameWithTier(input.name, tier);
  if (!trimmed) {
    return { accepted: false, reason: "Bonus name is required", state };
  }
  if (trimmed.length > 120) {
    return { accepted: false, reason: "Bonus name is too long", state };
  }

  const hasBetInput =
    input.betSize != null && String(input.betSize).trim() !== "";
  const betSize = parseBetSize(input.betSize);
  if (hasBetInput && betSize == null) {
    return {
      accepted: false,
      reason: "Bet size must be between $0.01 and $1,000",
      state,
    };
  }

  const hasWinInput =
    input.winAmount != null && String(input.winAmount).trim() !== "";
  let winAmount: number | null = null;
  if (hasWinInput) {
    winAmount = parseMoneyAmount(input.winAmount, { allowZero: true });
    if (winAmount == null) {
      return { accepted: false, reason: "Enter a valid win amount", state };
    }
  }

  const requestedBy = input.requestedBy?.trim().toLowerCase() || null;

  state.huntActive = true;
  state.bonuses.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: trimmed,
    betSize,
    winAmount,
    tier,
    requestedBy,
    createdAt: new Date().toISOString(),
  });
  markHuntStarted(state);
  return { accepted: true, state: touch(state) };
}

/** Move a chat slot request onto the bonus list, then drop it from the queue. */
export function promoteSlotRequestToBonus(input: {
  requestId: string;
  betSize?: string | number | null;
  winAmount?: string | number | null;
  tier?: BonusTier;
}): {
  accepted: boolean;
  reason?: string;
  state: BonusHuntState;
} {
  const state = getBonusHuntState();
  const request = state.slotRequests.find((req) => req.id === input.requestId);
  if (!request) {
    return { accepted: false, reason: "Slot request not found", state };
  }

  const result = addBonus({
    name: request.slotName,
    betSize: input.betSize,
    winAmount: input.winAmount,
    tier: input.tier,
    requestedBy: request.username,
  });
  if (!result.accepted) return result;

  result.state.slotRequests = result.state.slotRequests.filter(
    (req) => req.id !== input.requestId,
  );
  touch(result.state);
  return result;
}

export function setBonusWinAmount(input: {
  id: string;
  winAmount?: string | number | null;
}): {
  accepted: boolean;
  reason?: string;
  state: BonusHuntState;
} {
  const state = getBonusHuntState();
  const bonus = state.bonuses.find((item) => item.id === input.id);
  if (!bonus) {
    return { accepted: false, reason: "Bonus not found", state };
  }

  const hasInput =
    input.winAmount != null && String(input.winAmount).trim() !== "";
  if (!hasInput) {
    bonus.winAmount = null;
    return { accepted: true, state: touch(state) };
  }

  const winAmount = parseMoneyAmount(input.winAmount, { allowZero: true });
  if (winAmount == null) {
    return { accepted: false, reason: "Enter a valid win amount", state };
  }

  bonus.winAmount = winAmount;
  return { accepted: true, state: touch(state) };
}

export function removeBonus(id: string): BonusHuntState {
  const state = getBonusHuntState();
  state.bonuses = state.bonuses.filter((bonus) => bonus.id !== id);
  return touch(state);
}

export function clearBonuses(): BonusHuntState {
  const state = getBonusHuntState();
  state.bonuses = [];
  return touch(state);
}

const MAX_SLOT_REQUESTS_PER_USER = 3;

/** Pure helper — append a slot request onto a board snapshot (client or server). */
export function appendSlotRequestToState(
  state: BonusHuntState,
  username: string,
  slotName: string,
): {
  accepted: boolean;
  reason?: string;
  state: BonusHuntState;
} {
  if (!state.requestsOpen) {
    return { accepted: false, reason: "Slot requests are closed", state };
  }

  const normalized = username.trim().toLowerCase();
  if (!normalized) {
    return { accepted: false, reason: "Missing username", state };
  }

  const slot = slotName.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!slot) {
    return {
      accepted: false,
      reason: "Include a slot name after !s",
      state,
    };
  }

  const userRequests = state.slotRequests.filter(
    (req) => req.username === normalized,
  );
  const slotKey = slot.toLowerCase();
  const duplicateSlot = state.slotRequests.find(
    (req) => req.slotName.toLowerCase() === slotKey,
  );

  if (duplicateSlot) {
    return {
      accepted: false,
      reason:
        duplicateSlot.username === normalized
          ? "You already requested that slot"
          : "That slot was already requested",
      state,
    };
  }

  if (userRequests.length >= MAX_SLOT_REQUESTS_PER_USER) {
    return {
      accepted: false,
      reason: `Max ${MAX_SLOT_REQUESTS_PER_USER} slot requests per username`,
      state,
    };
  }

  const next: BonusHuntState = {
    ...state,
    huntActive: true,
    slotRequests: [
      ...state.slotRequests,
      {
        id: `${Date.now()}-${normalized}-${userRequests.length + 1}`,
        username: normalized,
        slotName: slot,
        createdAt: new Date().toISOString(),
      },
    ],
    updatedAt: new Date().toISOString(),
  };

  if (next.slotRequests.length > 200) {
    next.slotRequests = next.slotRequests.slice(-200);
  }

  return { accepted: true, state: next };
}

export function addSlotRequest(
  username: string,
  slotName: string,
): {
  accepted: boolean;
  reason?: string;
  state: BonusHuntState;
} {
  const state = getBonusHuntState();
  const result = appendSlotRequestToState(state, username, slotName);
  if (!result.accepted) return result;

  markHuntStarted(result.state);
  const g = globalThis as StoreGlobal;
  g.__bonusHuntState = result.state;
  persistState(result.state);
  return result;
}

export function clearSlotRequests(): BonusHuntState {
  const state = getBonusHuntState();
  state.slotRequests = [];
  return touch(state);
}

export function removeSlotRequest(id: string): BonusHuntState {
  const state = getBonusHuntState();
  state.slotRequests = state.slotRequests.filter((req) => req.id !== id);
  return touch(state);
}

/** Parse `!s Slot Name` / `!s: Slot Name` / `!slot Name` — null if missing a slot name. */
export function parseSlotRequestMessage(
  content: string,
): { slotName: string } | null {
  // Kick messages are usually plain text; strip a leading @mention if present.
  const cleaned = content.trim().replace(/^@[^\s]+\s+/u, "");
  const match = cleaned.match(/^!\s*s(?:lot)?\s*[:\-]?\s+(.+)$/i);
  if (!match) return null;
  const slotName = match[1].trim().replace(/\s+/g, " ").slice(0, 80);
  if (!slotName) return null;
  return { slotName };
}

export function isSlotRequestMessage(content: string): boolean {
  return parseSlotRequestMessage(content) != null;
}

export function verifyBonusHuntAdminToken(request: Request): boolean {
  const expected = process.env.GUESS_ADMIN_TOKEN;
  if (!expected) return false;
  return request.headers.get("x-admin-token") === expected;
}
