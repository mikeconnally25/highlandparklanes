export type BalanceGuess = {
  id: string;
  username: string;
  amount: number;
  rawMessage: string;
  createdAt: string;
};

export type GuessBalanceState = {
  entriesOpen: boolean;
  guesses: BalanceGuess[];
  updatedAt: string;
};

type StoreGlobal = typeof globalThis & {
  __guessBalanceState?: GuessBalanceState;
};

function createState(): GuessBalanceState {
  return {
    entriesOpen: false,
    guesses: [],
    updatedAt: new Date().toISOString(),
  };
}

export function getGuessBalanceState(): GuessBalanceState {
  const g = globalThis as StoreGlobal;
  if (!g.__guessBalanceState) g.__guessBalanceState = createState();
  return g.__guessBalanceState;
}

export function setEntriesOpen(open: boolean): GuessBalanceState {
  const state = getGuessBalanceState();
  state.entriesOpen = open;
  state.updatedAt = new Date().toISOString();
  return state;
}

export function clearGuesses(): GuessBalanceState {
  const state = getGuessBalanceState();
  state.guesses = [];
  state.updatedAt = new Date().toISOString();
  return state;
}

export function addGuess(input: {
  username: string;
  amount: number;
  rawMessage: string;
}): { accepted: boolean; reason?: string; state: GuessBalanceState } {
  const state = getGuessBalanceState();

  if (!state.entriesOpen) {
    return { accepted: false, reason: "Entries are closed", state };
  }

  const username = input.username.trim().toLowerCase();
  if (!username) {
    return { accepted: false, reason: "Missing username", state };
  }

  const existingIndex = state.guesses.findIndex(
    (g) => g.username === username,
  );
  const guess: BalanceGuess = {
    id: `${Date.now()}-${username}`,
    username,
    amount: input.amount,
    rawMessage: input.rawMessage,
    createdAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    state.guesses[existingIndex] = guess;
  } else {
    state.guesses.push(guess);
  }

  state.updatedAt = new Date().toISOString();
  return { accepted: true, state };
}

export function parseBalanceGuess(message: string): number | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  const commandMatch = trimmed.match(/^!guess\s+(.+)$/i);
  if (commandMatch) candidate = commandMatch[1].trim();

  candidate = candidate.replace(/[$,\s]/g, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(candidate)) return null;

  const amount = Number(candidate);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 999_999_999) {
    return null;
  }

  return Math.round(amount * 100) / 100;
}

export function verifyGuessAdminToken(request: Request): boolean {
  const expected = process.env.GUESS_ADMIN_TOKEN;
  if (!expected) return false;
  return request.headers.get("x-admin-token") === expected;
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

export type ClosestGuess = BalanceGuess & { difference: number };

export function getClosestGuesses(
  guesses: BalanceGuess[],
  actualBalance: number,
  limit = 3,
): ClosestGuess[] {
  return [...guesses]
    .map((guess) => ({
      ...guess,
      difference: Math.abs(guess.amount - actualBalance),
    }))
    .sort(
      (a, b) =>
        a.difference - b.difference ||
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
    .slice(0, limit);
}
