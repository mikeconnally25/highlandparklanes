export type BonusTier = "normal" | "super" | "epic";

export type BonusItem = {
  id: string;
  name: string;
  betSize: number | null;
  winAmount: number | null;
  tier: BonusTier;
  /** Kick username that requested this slot via !s, if any */
  requestedBy: string | null;
  /** Stake slot tile from kuratorGameQuery thumbnailUrl */
  thumbnailUrl: string | null;
  createdAt: string;
};

export type SlotRequest = {
  id: string;
  username: string;
  slotName: string;
  /** Stake slot tile from kuratorGameQuery thumbnailUrl */
  thumbnailUrl: string | null;
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

/** Empty board after End hunt — stamped so merges and overlays accept the reset. */
export function createIntentionalResetBoard(): BonusHuntState {
  const reset = createState();
  reset.updatedAt = new Date().toISOString();
  return reset;
}

/** End-hunt / clear-board snapshot (non-epoch updatedAt + all hunt fields empty). */
export function isIntentionalResetBoard(state: BonusHuntState): boolean {
  const updatedAt = Date.parse(state.updatedAt) || 0;
  if (updatedAt <= 0) return false;
  return (
    !state.huntActive &&
    !state.requestsOpen &&
    state.bonuses.length === 0 &&
    state.slotRequests.length === 0 &&
    !state.title.trim() &&
    state.startAmount == null
  );
}

export function remoteLooksLikeNewHunt(
  local: BonusHuntState,
  remote: BonusHuntState,
): boolean {
  const localT = Date.parse(local.updatedAt) || 0;
  const remoteT = Date.parse(remote.updatedAt) || 0;

  if (isIntentionalResetBoard(local)) {
    if (isIntentionalResetBoard(remote)) return false;
    return (
      remoteT > localT &&
      (remote.huntActive ||
        remote.requestsOpen ||
        remote.bonuses.length > 0 ||
        remote.slotRequests.length > 0)
    );
  }

  return (
    remote.huntActive ||
    remote.requestsOpen ||
    (remote.bonuses.length > 0 && remoteT > localT) ||
    (remote.slotRequests.length > 0 && remoteT > localT)
  );
}

function normalizeState(state: BonusHuntState): BonusHuntState {
  if (state.startAmount === undefined) state.startAmount = null;
  if (state.startedAt === undefined) state.startedAt = null;
  state.bonuses = (state.bonuses ?? []).map((bonus) => ({
    ...bonus,
    winAmount: bonus.winAmount ?? null,
    requestedBy: bonus.requestedBy ?? null,
    thumbnailUrl: bonus.thumbnailUrl ?? null,
    tier: bonus.tier ?? "normal",
  }));
  state.slotRequests = dedupeSlotRequests(
    (state.slotRequests ?? []).map((req) => ({
      ...req,
      slotName: req.slotName?.trim() || "—",
      thumbnailUrl: req.thumbnailUrl ?? null,
    })),
  );
  if (!state.updatedAt) state.updatedAt = new Date(0).toISOString();
  return state;
}

/** One queue row per slot name (matches appendSlotRequestToState rules). */
function dedupeSlotRequests(requests: SlotRequest[]): SlotRequest[] {
  const bySlot = new Map<string, SlotRequest>();
  const sorted = [...requests].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );
  for (const req of sorted) {
    const key = req.slotName.trim().toLowerCase();
    if (!key) continue;
    const prev = bySlot.get(key);
    if (!prev) {
      bySlot.set(key, req);
      continue;
    }
    if (!prev.thumbnailUrl && req.thumbnailUrl) {
      bySlot.set(key, req);
    }
  }
  return [...bySlot.values()].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );
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
  if (localReset && localT >= remoteT) return normalizeState(local);
  if (localReset && !remoteLooksLikeNewHunt(local, remote)) {
    return normalizeState(local);
  }

  const newer = remoteT >= localT ? remote : local;
  const older = newer === remote ? local : remote;
  const pickAmount = (a: number | null, b: number | null) => {
    if (a != null && a > 0) return a;
    if (b != null && b > 0) return b;
    return a ?? b ?? null;
  };

  // Prefer the richer bonus record when the same id appears on both boards
  // (keeps bet/win amounts from being wiped by a partial cold response).
  const bonusById = new Map<string, BonusItem>();
  for (const bonus of older.bonuses) bonusById.set(bonus.id, bonus);
  for (const bonus of newer.bonuses) {
    const prev = bonusById.get(bonus.id);
    if (!prev) {
      bonusById.set(bonus.id, bonus);
      continue;
    }
    bonusById.set(bonus.id, {
      ...prev,
      ...bonus,
      betSize: pickAmount(bonus.betSize, prev.betSize),
      winAmount:
        bonus.winAmount != null ? bonus.winAmount : (prev.winAmount ?? null),
      requestedBy: bonus.requestedBy ?? prev.requestedBy,
      thumbnailUrl: bonus.thumbnailUrl ?? prev.thumbnailUrl,
      name: bonus.name.trim() || prev.name,
    });
  }

  const requestById = new Map<string, SlotRequest>();
  for (const req of older.slotRequests) requestById.set(req.id, req);
  for (const req of newer.slotRequests) {
    const prev = requestById.get(req.id);
    requestById.set(
      req.id,
      prev
        ? {
            ...prev,
            ...req,
            thumbnailUrl: req.thumbnailUrl ?? prev.thumbnailUrl,
          }
        : req,
    );
  }

  return removeFulfilledSlotRequests(
    normalizeState({
      ...newer,
      title: newer.title.trim() || older.title,
      startAmount: pickAmount(newer.startAmount, older.startAmount),
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
    }),
  );
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
      const normalized = normalizeState(remote);
      if (isIntentionalResetBoard(normalized)) {
        g.__bonusHuntState = normalized;
      } else {
        g.__bonusHuntState = richerState(g.__bonusHuntState, normalized);
      }
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

/** Build an archive snapshot from the current board (pure — no mutation). */
export function buildPastHuntArchive(
  state: BonusHuntState,
): PastHuntResult | null {
  const hasContent =
    state.bonuses.length > 0 ||
    state.startAmount != null ||
    Boolean(state.title.trim());
  if (!hasContent) return null;

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: state.title.trim() || "Untitled hunt",
    startAmount: state.startAmount,
    bonuses: state.bonuses.map((bonus) => ({ ...bonus })),
    stats: getHuntStats(state),
    startedAt: state.startedAt,
    endedAt: new Date().toISOString(),
  };
}

export function mergePastHuntLists(
  ...lists: PastHuntResult[][]
): PastHuntResult[] {
  const byId = new Map<string, PastHuntResult>();
  for (const list of lists) {
    for (const hunt of list) {
      byId.set(hunt.id, hunt);
    }
  }
  return [...byId.values()]
    .sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt))
    .slice(0, MAX_PAST_HUNTS);
}

export function appendPastHunt(archived: PastHuntResult): PastHuntResult[] {
  const history = getPastHunts();
  if (!history.some((hunt) => hunt.id === archived.id)) {
    history.unshift(archived);
    if (history.length > MAX_PAST_HUNTS) {
      history.length = MAX_PAST_HUNTS;
    }
  }
  const g = globalThis as StoreGlobal;
  g.__bonusHuntHistory = history;
  persistHistory(history);
  return history;
}

export function replacePastHunts(hunts: PastHuntResult[]): PastHuntResult[] {
  const g = globalThis as StoreGlobal;
  const next = mergePastHuntLists(hunts);
  g.__bonusHuntHistory = next;
  persistHistory(next);
  return next;
}

/** Archive the current hunt into past results and reset the active board. */
export function endAndArchiveHunt(): {
  accepted: boolean;
  reason?: string;
  state: BonusHuntState;
  archived: PastHuntResult | null;
  hunts: PastHuntResult[];
} {
  const state = getBonusHuntState();
  const archived = buildPastHuntArchive(state);

  if (archived) {
    appendPastHunt(archived);
  }

  const g = globalThis as StoreGlobal;
  const reset = createIntentionalResetBoard();
  g.__bonusHuntState = reset;
  persistState(reset);
  return {
    accepted: true,
    state: reset,
    archived,
    hunts: getPastHunts(),
  };
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
  const startAmountRaw = state.startAmount as unknown;
  const startAmount =
    typeof startAmountRaw === "number"
      ? startAmountRaw
      : typeof startAmountRaw === "string"
        ? Number.parseFloat(startAmountRaw.replace(/[^0-9.-]/g, ""))
        : null;
  const start =
    startAmount != null && Number.isFinite(startAmount) && startAmount > 0
      ? startAmount
      : null;

  const totalBet = state.bonuses.reduce((sum, bonus) => {
    const bet =
      typeof bonus.betSize === "number"
        ? bonus.betSize
        : typeof bonus.betSize === "string"
          ? Number.parseFloat(String(bonus.betSize).replace(/[^0-9.-]/g, ""))
          : null;
    return bet != null && Number.isFinite(bet) && bet > 0 ? sum + bet : sum;
  }, 0);

  const openedBonuses = state.bonuses.filter((bonus) => {
    const bet =
      typeof bonus.betSize === "number"
        ? bonus.betSize
        : null;
    return bonus.winAmount != null && bet != null && bet > 0;
  });
  const remainingBonuses = state.bonuses.filter((bonus) => {
    const bet =
      typeof bonus.betSize === "number"
        ? bonus.betSize
        : null;
    return bonus.winAmount == null && bet != null && bet > 0;
  });

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
    start != null
      ? Math.round(Math.max(0, start - totalWins) * 100) / 100
      : null;

  const breakEvenReached = start != null && totalWins >= start;

  // Classic avg x to break even = start bankroll ÷ total bet on the hunt list.
  let breakEvenX: number | null = null;
  if (start != null && totalBet > 0) {
    if (breakEvenReached) {
      breakEvenX = 0;
    } else {
      breakEvenX = Math.round((start / totalBet) * 100) / 100;
    }
  }

  return {
    startAmount: start,
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

function stripBonusTierSuffix(name: string): string {
  return name.trim().replace(/\s*\((?:super|epic)\)\s*$/i, "").trim();
}

function slotNamesMatch(a: string, b: string): boolean {
  return (
    stripBonusTierSuffix(a).toLowerCase() ===
    stripBonusTierSuffix(b).toLowerCase()
  );
}

/** Drop queue rows that already appear on the bonus list. */
export function removeFulfilledSlotRequests(
  state: BonusHuntState,
): BonusHuntState {
  const slotRequests = state.slotRequests.filter(
    (req) =>
      !state.bonuses.some((bonus) => {
        if (!slotNamesMatch(req.slotName, bonus.name)) return false;
        if (bonus.requestedBy) {
          return (
            req.username.toLowerCase() === bonus.requestedBy.toLowerCase()
          );
        }
        return true;
      }),
  );
  if (slotRequests.length === state.slotRequests.length) return state;
  return { ...state, slotRequests };
}

export function addBonus(input: {
  name: string;
  betSize?: string | number | null;
  winAmount?: string | number | null;
  tier?: BonusTier;
  requestedBy?: string | null;
  requestId?: string | null;
  thumbnailUrl?: string | null;
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

  let thumbnailUrl = input.thumbnailUrl?.trim() || null;
  if (input.requestId) {
    const request = state.slotRequests.find((req) => req.id === input.requestId);
    if (request?.thumbnailUrl) thumbnailUrl = request.thumbnailUrl;
  }
  if (!thumbnailUrl) {
    const matchedRequest = state.slotRequests.find((req) =>
      slotNamesMatch(req.slotName, trimmed),
    );
    if (matchedRequest?.thumbnailUrl) {
      thumbnailUrl = matchedRequest.thumbnailUrl;
    }
  }

  state.huntActive = true;
  state.bonuses.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: trimmed,
    betSize,
    winAmount,
    tier,
    requestedBy,
    thumbnailUrl,
    createdAt: new Date().toISOString(),
  });
  if (input.requestId) {
    state.slotRequests = state.slotRequests.filter(
      (req) => req.id !== input.requestId,
    );
  }
  markHuntStarted(state);
  return { accepted: true, state: touch(removeFulfilledSlotRequests(state)) };
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
    requestId: input.requestId,
    thumbnailUrl: request.thumbnailUrl,
  });
  if (!result.accepted) return result;

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
  thumbnailUrl?: string | null,
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
        thumbnailUrl: thumbnailUrl?.trim() || null,
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
  thumbnailUrl?: string | null,
): {
  accepted: boolean;
  reason?: string;
  state: BonusHuntState;
} {
  const state = getBonusHuntState();
  const result = appendSlotRequestToState(
    state,
    username,
    slotName,
    thumbnailUrl,
  );
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
