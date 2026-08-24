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
};

const MAX_PAST_HUNTS = 50;

function createState(): BonusHuntState {
  return {
    huntActive: false,
    requestsOpen: false,
    title: "",
    startAmount: null,
    bonuses: [],
    slotRequests: [],
    startedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

export function getBonusHuntState(): BonusHuntState {
  const g = globalThis as StoreGlobal;
  if (!g.__bonusHuntState) g.__bonusHuntState = createState();

  const state = g.__bonusHuntState;
  if (state.startAmount === undefined) state.startAmount = null;
  if (state.startedAt === undefined) state.startedAt = null;
  state.bonuses = state.bonuses.map((bonus) => ({
    ...bonus,
    winAmount: bonus.winAmount ?? null,
    requestedBy: bonus.requestedBy ?? null,
  }));
  state.slotRequests = state.slotRequests.map((req) => ({
    ...req,
    slotName: req.slotName?.trim() || "—",
  }));

  return state;
}

export function getPastHunts(): PastHuntResult[] {
  const g = globalThis as StoreGlobal;
  if (!g.__bonusHuntHistory) g.__bonusHuntHistory = [];
  return g.__bonusHuntHistory;
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
    markHuntStarted(state);
  } else {
    state.requestsOpen = false;
  }
  state.updatedAt = new Date().toISOString();
  return state;
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
  g.__bonusHuntState = createState();
  return { accepted: true, state: getBonusHuntState(), archived };
}

export function getPastHunt(id: string): PastHuntResult | null {
  return getPastHunts().find((hunt) => hunt.id === id) ?? null;
}

export function clearPastHunts(): PastHuntResult[] {
  const g = globalThis as StoreGlobal;
  g.__bonusHuntHistory = [];
  return g.__bonusHuntHistory;
}

export function setHuntTitle(title: string): BonusHuntState {
  const state = getBonusHuntState();
  state.title = title.trim();
  if (state.title) {
    state.huntActive = true;
    markHuntStarted(state);
  }
  state.updatedAt = new Date().toISOString();
  return state;
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
    state.updatedAt = new Date().toISOString();
    return { accepted: true, state };
  }

  const amount = parseMoneyAmount(value, { allowZero: false });
  if (amount == null) {
    return { accepted: false, reason: "Enter a valid start amount", state };
  }

  state.startAmount = amount;
  state.huntActive = true;
  markHuntStarted(state);
  state.updatedAt = new Date().toISOString();
  return { accepted: true, state };
}

export function setRequestsOpen(open: boolean): BonusHuntState {
  const state = getBonusHuntState();
  state.requestsOpen = open;
  if (open) {
    state.huntActive = true;
    markHuntStarted(state);
  }
  state.updatedAt = new Date().toISOString();
  return state;
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
  const trimmed = input.name.trim();
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

  const tier: BonusTier =
    input.tier === "super" || input.tier === "epic" ? input.tier : "normal";

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
  state.updatedAt = new Date().toISOString();
  return { accepted: true, state };
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
  result.state.updatedAt = new Date().toISOString();
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
    state.updatedAt = new Date().toISOString();
    return { accepted: true, state };
  }

  const winAmount = parseMoneyAmount(input.winAmount, { allowZero: true });
  if (winAmount == null) {
    return { accepted: false, reason: "Enter a valid win amount", state };
  }

  bonus.winAmount = winAmount;
  state.updatedAt = new Date().toISOString();
  return { accepted: true, state };
}

export function removeBonus(id: string): BonusHuntState {
  const state = getBonusHuntState();
  state.bonuses = state.bonuses.filter((bonus) => bonus.id !== id);
  state.updatedAt = new Date().toISOString();
  return state;
}

export function clearBonuses(): BonusHuntState {
  const state = getBonusHuntState();
  state.bonuses = [];
  state.updatedAt = new Date().toISOString();
  return state;
}

const MAX_SLOT_REQUESTS_PER_USER = 3;

export function addSlotRequest(
  username: string,
  slotName: string,
): {
  accepted: boolean;
  reason?: string;
  state: BonusHuntState;
} {
  const state = getBonusHuntState();

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

  state.slotRequests.push({
    id: `${Date.now()}-${normalized}-${userRequests.length + 1}`,
    username: normalized,
    slotName: slot,
    createdAt: new Date().toISOString(),
  });

  if (state.slotRequests.length > 200) {
    state.slotRequests = state.slotRequests.slice(-200);
  }

  state.updatedAt = new Date().toISOString();
  return { accepted: true, state };
}

export function clearSlotRequests(): BonusHuntState {
  const state = getBonusHuntState();
  state.slotRequests = [];
  state.updatedAt = new Date().toISOString();
  return state;
}

export function removeSlotRequest(id: string): BonusHuntState {
  const state = getBonusHuntState();
  state.slotRequests = state.slotRequests.filter((req) => req.id !== id);
  state.updatedAt = new Date().toISOString();
  return state;
}

/** Parse `!s Slot Name` — null if missing a slot name. */
export function parseSlotRequestMessage(
  content: string,
): { slotName: string } | null {
  const match = content.trim().match(/^!s\s+(.+)$/i);
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
