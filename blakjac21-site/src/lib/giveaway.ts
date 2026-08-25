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

export function normalizeGiveawayKeyword(keyword: string): string {
  return keyword.trim().toLowerCase();
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
