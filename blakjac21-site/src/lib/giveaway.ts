export type GiveawayEntry = {
  id: string;
  username: string;
  rawMessage: string;
  createdAt: string;
};

export type GiveawayState = {
  entriesOpen: boolean;
  keyword: string;
  entries: GiveawayEntry[];
  updatedAt: string;
};

type StoreGlobal = typeof globalThis & {
  __giveawayState?: GiveawayState;
};

function createState(): GiveawayState {
  return {
    entriesOpen: false,
    keyword: "",
    entries: [],
    updatedAt: new Date().toISOString(),
  };
}

export function getGiveawayState(): GiveawayState {
  const g = globalThis as StoreGlobal;
  if (!g.__giveawayState) g.__giveawayState = createState();
  return g.__giveawayState;
}

export function setGiveawayKeyword(keyword: string): GiveawayState {
  const state = getGiveawayState();
  state.keyword = keyword.trim();
  state.updatedAt = new Date().toISOString();
  return state;
}

export function setGiveawayEntriesOpen(open: boolean): GiveawayState {
  const state = getGiveawayState();
  state.entriesOpen = open;
  state.updatedAt = new Date().toISOString();
  return state;
}

export function clearGiveawayEntries(): GiveawayState {
  const state = getGiveawayState();
  state.entries = [];
  state.updatedAt = new Date().toISOString();
  return state;
}

export function removeGiveawayEntry(username: string): {
  removed: boolean;
  state: GiveawayState;
} {
  const state = getGiveawayState();
  const needle = username.trim().toLowerCase();
  if (!needle) return { removed: false, state };

  const before = state.entries.length;
  state.entries = state.entries.filter((entry) => entry.username !== needle);
  if (state.entries.length !== before) {
    state.updatedAt = new Date().toISOString();
    return { removed: true, state };
  }
  return { removed: false, state };
}

export function normalizeGiveawayKeyword(keyword: string): string {
  return keyword.trim().toLowerCase();
}

export const GIVEAWAY_CLAIM_KEYWORD = "claim";

/** Winner must type claim / !claim in Kick chat within the claim window. */
export function messageMatchesGiveawayClaim(message: string): boolean {
  const normalized = normalizeGiveawayKeyword(message);
  return (
    normalized === GIVEAWAY_CLAIM_KEYWORD ||
    normalized === `!${GIVEAWAY_CLAIM_KEYWORD}`
  );
}

/** Chat message counts as an entry when it matches the keyword (case-insensitive). */
export function messageMatchesGiveawayKeyword(
  message: string,
  keyword: string,
): boolean {
  const needle = normalizeGiveawayKeyword(keyword);
  if (!needle) return false;
  return normalizeGiveawayKeyword(message) === needle;
}

export function addGiveawayEntry(input: {
  username: string;
  rawMessage: string;
}): { accepted: boolean; reason?: string; state: GiveawayState } {
  const state = getGiveawayState();

  if (!state.entriesOpen) {
    return { accepted: false, reason: "Entries are closed", state };
  }

  const keyword = normalizeGiveawayKeyword(state.keyword);
  if (!keyword) {
    return { accepted: false, reason: "No keyword set", state };
  }

  if (!messageMatchesGiveawayKeyword(input.rawMessage, state.keyword)) {
    return { accepted: false, reason: "Message does not match keyword", state };
  }

  const username = input.username.trim().toLowerCase();
  if (!username) {
    return { accepted: false, reason: "Missing username", state };
  }

  if (state.entries.some((entry) => entry.username === username)) {
    return { accepted: false, reason: "Already entered", state };
  }

  state.entries.push({
    id: `${Date.now()}-${username}`,
    username,
    rawMessage: input.rawMessage.trim(),
    createdAt: new Date().toISOString(),
  });
  state.updatedAt = new Date().toISOString();
  return { accepted: true, state };
}

export function verifyGiveawayAdminToken(request: Request): boolean {
  const expected = process.env.GUESS_ADMIN_TOKEN;
  if (!expected) return false;
  return request.headers.get("x-admin-token") === expected;
}
