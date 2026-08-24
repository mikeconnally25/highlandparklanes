export type BonusTier = "normal" | "super" | "epic";

export type BonusItem = {
  id: string;
  name: string;
  tier: BonusTier;
  createdAt: string;
};

export type SlotRequest = {
  id: string;
  username: string;
  createdAt: string;
};

export type BonusHuntState = {
  huntActive: boolean;
  requestsOpen: boolean;
  title: string;
  bonuses: BonusItem[];
  slotRequests: SlotRequest[];
  updatedAt: string;
};

type StoreGlobal = typeof globalThis & {
  __bonusHuntState?: BonusHuntState;
};

function createState(): BonusHuntState {
  return {
    huntActive: false,
    requestsOpen: false,
    title: "",
    bonuses: [],
    slotRequests: [],
    updatedAt: new Date().toISOString(),
  };
}

export function getBonusHuntState(): BonusHuntState {
  const g = globalThis as StoreGlobal;
  if (!g.__bonusHuntState) g.__bonusHuntState = createState();
  return g.__bonusHuntState;
}

export function setHuntActive(active: boolean): BonusHuntState {
  const state = getBonusHuntState();
  state.huntActive = active;
  if (!active) {
    state.requestsOpen = false;
  }
  state.updatedAt = new Date().toISOString();
  return state;
}

export function setHuntTitle(title: string): BonusHuntState {
  const state = getBonusHuntState();
  state.title = title.trim();
  state.updatedAt = new Date().toISOString();
  return state;
}

export function setRequestsOpen(open: boolean): BonusHuntState {
  const state = getBonusHuntState();
  state.requestsOpen = open;
  if (open) state.huntActive = true;
  state.updatedAt = new Date().toISOString();
  return state;
}

export function addBonus(input: {
  name: string;
  tier?: BonusTier;
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

  const tier: BonusTier =
    input.tier === "super" || input.tier === "epic" ? input.tier : "normal";

  state.huntActive = true;
  state.bonuses.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: trimmed,
    tier,
    createdAt: new Date().toISOString(),
  });
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

export function addSlotRequest(username: string): {
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

  if (state.slotRequests.some((req) => req.username === normalized)) {
    return { accepted: false, reason: "Already in the queue", state };
  }

  state.slotRequests.push({
    id: `${Date.now()}-${normalized}`,
    username: normalized,
    createdAt: new Date().toISOString(),
  });
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

export function isSlotRequestMessage(content: string): boolean {
  return /^!r(?:\s|$)/i.test(content.trim());
}

export function verifyBonusHuntAdminToken(request: Request): boolean {
  const expected = process.env.GUESS_ADMIN_TOKEN;
  if (!expected) return false;
  return request.headers.get("x-admin-token") === expected;
}
