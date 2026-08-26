import type { BonusHuntState } from "@/lib/bonus-hunt";

export const HUNT_CACHE_KEY = "blakjac21-bonus-hunt-cache-v1";
export const HUNT_LIVE_EVENT = "bonus-hunt-live-state";

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

export function preferHuntBoard(
  local: BonusHuntState | null,
  remote: BonusHuntState,
): BonusHuntState {
  if (!local) return remote;
  const localT = Date.parse(local.updatedAt) || 0;
  const remoteT = Date.parse(remote.updatedAt) || 0;

  // Never replace a populated board with an empty serverless response
  if (local.bonuses.length > 0 && remote.bonuses.length === 0) return local;
  if (remote.bonuses.length < local.bonuses.length && remoteT <= localT + 2000) {
    return local;
  }
  if (remoteT < localT && local.bonuses.length >= remote.bonuses.length) {
    return local;
  }
  return remote;
}

export function writeHuntCache(state: BonusHuntState) {
  if (typeof window === "undefined") return;
  const existing = readHuntCache();
  const toStore = preferHuntBoard(existing, state);
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

export function buildOverlayUrl(origin: string, state: BonusHuntState | null) {
  const base = `${origin}/bonus-hunts/overlay`;
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
