import type { BonusHuntState, PastHuntResult } from "@/lib/bonus-hunt";
import { mergeHuntBoards, mergePastHuntLists } from "@/lib/bonus-hunt";

export const HUNT_CACHE_KEY = "blakjac21-bonus-hunt-cache-v1";
export const HUNT_HISTORY_CACHE_KEY = "blakjac21-bonus-hunt-history-v1";
export const HUNT_LIVE_EVENT = "bonus-hunt-live-state";
export const HUNT_HISTORY_EVENT = "bonus-hunt-history-changed";

export function readHuntCache(): BonusHuntState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(HUNT_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BonusHuntState;
  } catch {
    return null;
  }
}

function isIntentionalReset(remote: BonusHuntState): boolean {
  const remoteT = Date.parse(remote.updatedAt) || 0;
  // createState uses epoch; intentional end/clear always stamps a real time.
  if (remoteT <= 0) return false;
  return (
    !remote.huntActive &&
    !remote.requestsOpen &&
    remote.bonuses.length === 0 &&
    remote.slotRequests.length === 0 &&
    !remote.title.trim() &&
    remote.startAmount == null
  );
}

export function preferHuntBoard(
  local: BonusHuntState | null,
  remote: BonusHuntState,
): BonusHuntState {
  if (!local) return remote;
  const localT = Date.parse(local.updatedAt) || 0;
  const remoteT = Date.parse(remote.updatedAt) || 0;

  // End hunt / clear must win even when remote is empty.
  if (isIntentionalReset(remote) && remoteT >= localT) return remote;

  return mergeHuntBoards(local, remote);
}

export function writeHuntCache(state: BonusHuntState) {
  if (typeof window === "undefined") return;
  // Always write the authoring browser's latest snapshot for intentional resets.
  const existing = readHuntCache();
  const toStore = isIntentionalReset(state)
    ? state
    : preferHuntBoard(existing, state);
  try {
    window.localStorage.setItem(HUNT_CACHE_KEY, JSON.stringify(toStore));
  } catch {
    /* ignore quota */
  }
  try {
    window.dispatchEvent(
      new CustomEvent<BonusHuntState>(HUNT_LIVE_EVENT, { detail: toStore }),
    );
  } catch {
    /* ignore */
  }
}

export function readHuntHashSeed(): BonusHuntState | null {
  if (typeof window === "undefined") return null;
  try {
    const hash = window.location.hash;
    if (!hash.startsWith("#hunt=")) return null;
    const raw = decodeURIComponent(hash.slice("#hunt=".length));
    if (!raw) return null;
    return JSON.parse(raw) as BonusHuntState;
  } catch {
    return null;
  }
}

export function buildOverlayUrl(
  origin: string,
  state: BonusHuntState | null,
  path = "/bonus-hunts/overlay",
) {
  const base = `${origin}${path}`;
  if (!state || state.bonuses.length === 0) return base;
  try {
    const encoded = encodeURIComponent(JSON.stringify(state));
    // Keep URL under common browser limits; fall back to bare path if huge
    if (encoded.length > 12_000) return base;
    return `${base}#hunt=${encoded}`;
  } catch {
    return base;
  }
}

export function buildHuntListOverlayUrl(
  origin: string,
  state: BonusHuntState | null,
) {
  return buildOverlayUrl(origin, state, "/bonus-hunts/overlay/list");
}

export function readHuntHistoryCache(): PastHuntResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HUNT_HISTORY_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PastHuntResult[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeHuntHistoryCache(hunts: PastHuntResult[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      HUNT_HISTORY_CACHE_KEY,
      JSON.stringify(hunts),
    );
  } catch {
    /* ignore quota */
  }
  try {
    window.dispatchEvent(new Event(HUNT_HISTORY_EVENT));
  } catch {
    /* ignore */
  }
}

export function preferPastHunts(
  local: PastHuntResult[],
  remote: PastHuntResult[],
): PastHuntResult[] {
  return mergePastHuntLists(local, remote);
}

export function appendPastHuntToCache(
  archived: PastHuntResult,
): PastHuntResult[] {
  const next = preferPastHunts(readHuntHistoryCache(), [archived]);
  writeHuntHistoryCache(next);
  return next;
}
