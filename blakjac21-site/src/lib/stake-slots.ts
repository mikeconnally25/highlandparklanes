/**
 * Stake slot catalog for !s validation.
 * Sources: Only on Stake + New Releases (via Stake GraphQL).
 * Catalog refreshes periodically so names stay current as Stake updates.
 */

export type StakeSlotSource = "only-on-stake" | "new-releases";

export type StakeSlot = {
  id: string;
  name: string;
  slug: string;
  sources: StakeSlotSource[];
};

export type StakeSlotCatalog = {
  slots: StakeSlot[];
  byNormalizedName: Map<string, StakeSlot>;
  expectedCounts: Record<StakeSlotSource, number>;
  updatedAt: string | null;
  refreshing: boolean;
  lastError: string | null;
};

type StakeGroupConfig = {
  source: StakeSlotSource;
  slug: string;
  groupName: string;
  /** Filled from slugKuratorGroup on refresh */
  id?: string;
};

const STAKE_GRAPHQL = "https://stake.us/_api/graphql";

const GROUPS: StakeGroupConfig[] = [
  {
    source: "only-on-stake",
    slug: "only-on-stake",
    groupName: "Only on Stake",
  },
  {
    source: "new-releases",
    slug: "new-releases",
    groupName: "New Releases",
  },
];

/** Full catalog crawl cadence */
const REFRESH_INTERVAL_MS = 10_000;
/** How often to refresh group gameCount metadata */
const META_REFRESH_INTERVAL_MS = 10_000;
/** Negative live-lookup cache (invalid names) */
const NEGATIVE_CACHE_MS = 5 * 60 * 1000;
/** Positive live-lookup cache */
const POSITIVE_CACHE_MS = 60 * 60 * 1000;

type CachedLookup = {
  slot: StakeSlot | null;
  expiresAt: number;
};

const lookupCache = new Map<string, CachedLookup>();

let catalog: StakeSlotCatalog = {
  slots: [],
  byNormalizedName: new Map(),
  expectedCounts: {
    "only-on-stake": 0,
    "new-releases": 0,
  },
  updatedAt: null,
  refreshing: false,
  lastError: null,
};

let cachedGroups: StakeGroupConfig[] | null = null;
let groupsFetchedAt = 0;
let refreshPromise: Promise<void> | null = null;
let metaPromise: Promise<void> | null = null;
/** Prevent hammering Stake when a crawl fails */
let lastCrawlAttemptAt = 0;
const CRAWL_RETRY_MS = 10_000;

export function normalizeSlotKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function stakeHeaders(): HeadersInit {
  return {
    "content-type": "application/json",
    accept: "application/json",
    "user-agent":
      "Mozilla/5.0 (compatible; Blakjac21SlotBot/1.0; +https://kick.com/Blakjac21)",
    "x-language": "en",
  };
}

async function stakeGraphql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(STAKE_GRAPHQL, {
    method: "POST",
    headers: stakeHeaders(),
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Stake GraphQL HTTP ${res.status}`);
  }

  const json = (await res.json()) as {
    data?: T;
    errors?: { message?: string }[];
  };

  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message ?? "Stake GraphQL error");
  }

  if (!json.data) {
    throw new Error("Stake GraphQL returned no data");
  }

  return json.data;
}

async function resolveGroupIds(force = false): Promise<StakeGroupConfig[]> {
  if (
    !force &&
    cachedGroups &&
    Date.now() - groupsFetchedAt < META_REFRESH_INTERVAL_MS
  ) {
    return cachedGroups;
  }

  const data = await stakeGraphql<{
    onlyOnStake: { id: string; gameCount: number } | null;
    newReleases: { id: string; gameCount: number } | null;
  }>(`
    query {
      onlyOnStake: slugKuratorGroup(slug: "only-on-stake") { id gameCount }
      newReleases: slugKuratorGroup(slug: "new-releases") { id gameCount }
    }
  `);

  const next = GROUPS.map((group) => {
    const meta =
      group.source === "only-on-stake" ? data.onlyOnStake : data.newReleases;
    return {
      ...group,
      id: meta?.id,
    };
  });

  catalog.expectedCounts = {
    "only-on-stake": data.onlyOnStake?.gameCount ?? 0,
    "new-releases": data.newReleases?.gameCount ?? 0,
  };

  cachedGroups = next;
  groupsFetchedAt = Date.now();
  return next;
}

type GameHit = {
  id: string;
  name: string;
  slug: string;
  inGroup: { id: string } | null;
};

async function searchGroupGames(
  query: string,
  group: StakeGroupConfig,
): Promise<GameHit[]> {
  if (!group.id) return [];

  const data = await stakeGraphql<{ kuratorGameQuery: GameHit[] }>(
    `
    query ($q: String!, $g: [String!], $gn: String!) {
      kuratorGameQuery(query: $q, groupIds: $g, limit: 50) {
        id
        name
        slug
        inGroup: groupGame(groupName: $gn) { id }
      }
    }
  `,
    { q: query, g: [group.id], gn: group.groupName },
  );

  return data.kuratorGameQuery ?? [];
}

function crawlQueries(): string[] {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const queries = new Set<string>();

  for (const c of letters + digits) queries.add(c);
  for (const a of letters) {
    for (const b of letters) queries.add(`${a}${b}`);
  }
  // Extra coverage for numbered sequels / titles
  for (const a of letters) {
    for (const d of digits) queries.add(`${a}${d}`);
  }

  return [...queries];
}

function mergeSlot(
  map: Map<string, StakeSlot>,
  hit: GameHit,
  source: StakeSlotSource,
) {
  if (!hit.inGroup) return;
  const existing = map.get(hit.id);
  if (existing) {
    if (!existing.sources.includes(source)) {
      existing.sources.push(source);
    }
    return;
  }
  map.set(hit.id, {
    id: hit.id,
    name: hit.name,
    slug: hit.slug,
    sources: [source],
  });
}

function rebuildIndexes(slots: StakeSlot[]) {
  const byNormalizedName = new Map<string, StakeSlot>();
  for (const slot of slots) {
    const key = normalizeSlotKey(slot.name);
    if (!key) continue;
    const prev = byNormalizedName.get(key);
    if (!prev) {
      byNormalizedName.set(key, slot);
      continue;
    }
    // Prefer entry that covers more sources
    if (slot.sources.length > prev.sources.length) {
      byNormalizedName.set(key, slot);
    }
  }
  catalog = {
    ...catalog,
    slots: [...slots].sort((a, b) => a.name.localeCompare(b.name)),
    byNormalizedName,
  };
}

async function crawlCatalog(groups: StakeGroupConfig[]): Promise<StakeSlot[]> {
  const byId = new Map<string, StakeSlot>();
  const queries = crawlQueries();
  const concurrency = 4;

  for (const group of groups) {
    if (!group.id) continue;

    for (let i = 0; i < queries.length; i += concurrency) {
      const batch = queries.slice(i, i + concurrency);
      const results = await Promise.all(
        batch.map(async (q) => {
          try {
            return await searchGroupGames(q, group);
          } catch {
            return [] as GameHit[];
          }
        }),
      );
      for (const hits of results) {
        for (const hit of hits) mergeSlot(byId, hit, group.source);
      }
      // Gentle pacing so Stake rate limits stay happy
      await new Promise((r) => setTimeout(r, 40));
    }
  }

  return [...byId.values()];
}

export function getStakeSlotCatalog(): StakeSlotCatalog {
  return catalog;
}

export function isCatalogStale(): boolean {
  if (!catalog.updatedAt || catalog.slots.length === 0) return true;
  return Date.now() - Date.parse(catalog.updatedAt) > REFRESH_INTERVAL_MS;
}

function canAttemptCrawl(): boolean {
  if (catalog.refreshing) return false;
  if (!isCatalogStale()) return false;
  if (
    lastCrawlAttemptAt > 0 &&
    Date.now() - lastCrawlAttemptAt < CRAWL_RETRY_MS &&
    catalog.slots.length === 0
  ) {
    return false;
  }
  return true;
}

/** Refresh group metadata (counts/ids). Cheap — safe to call often. */
export async function refreshStakeSlotMeta(): Promise<void> {
  if (metaPromise) {
    await metaPromise;
    return;
  }
  metaPromise = (async () => {
    try {
      await resolveGroupIds(true);
      catalog.lastError = null;
    } catch (err) {
      catalog.lastError =
        err instanceof Error ? err.message : "Failed to reach Stake";
    } finally {
      metaPromise = null;
    }
  })();
  await metaPromise;
}

/**
 * Full prefix crawl of both Stake groups (Only on Stake + New Releases).
 * Runs automatically every 10 seconds when the previous crawl has finished,
 * and on-demand via admin `GET /api/bonus-hunt/slots?refresh=1`.
 */
export async function refreshStakeSlotCatalog(
  force = false,
): Promise<StakeSlotCatalog> {
  if (catalog.refreshing && refreshPromise) {
    await refreshPromise;
    return catalog;
  }

  if (!force && !isCatalogStale()) {
    return catalog;
  }

  catalog.refreshing = true;
  lastCrawlAttemptAt = Date.now();
  refreshPromise = (async () => {
    try {
      const groups = await resolveGroupIds(true);
      const slots = await crawlCatalog(groups);
      if (slots.length > 0) {
        rebuildIndexes(slots);
        catalog.updatedAt = new Date().toISOString();
        catalog.lastError = null;
      } else {
        catalog.lastError = "Stake returned no slots during refresh";
      }
    } catch (err) {
      catalog.lastError =
        err instanceof Error ? err.message : "Failed to refresh Stake slots";
    } finally {
      catalog.refreshing = false;
      refreshPromise = null;
    }
  })();

  await refreshPromise;
  return catalog;
}

/**
 * Keep Stake data warm:
 * - full slot catalog crawl every 10 seconds when stale
 * Live !s lookups still verify against Stake between crawls.
 */
export function ensureStakeSlotCatalog(): void {
  if (canAttemptCrawl()) {
    void refreshStakeSlotCatalog(false);
    return;
  }
  if (metaPromise) return;
  if (Date.now() - groupsFetchedAt < META_REFRESH_INTERVAL_MS) return;
  void refreshStakeSlotMeta();
}

export function getCatalogNextRefreshAt(): string | null {
  if (!catalog.updatedAt) return null;
  const next = Date.parse(catalog.updatedAt) + REFRESH_INTERVAL_MS;
  if (Number.isNaN(next)) return null;
  return new Date(next).toISOString();
}

function findInCatalog(slotName: string): StakeSlot | null {
  const key = normalizeSlotKey(slotName);
  if (!key) return null;
  return catalog.byNormalizedName.get(key) ?? null;
}

function pickExactLiveMatch(
  slotName: string,
  hits: Array<GameHit & { source: StakeSlotSource }>,
): StakeSlot | null {
  const key = normalizeSlotKey(slotName);
  if (!key) return null;

  const exact = hits.filter(
    (h) => h.inGroup && normalizeSlotKey(h.name) === key,
  );
  if (exact.length === 0) return null;

  const byId = new Map<string, StakeSlot>();
  for (const hit of exact) {
    mergeSlot(byId, hit, hit.source);
  }
  return [...byId.values()][0] ?? null;
}

/**
 * Live Stake lookup: search both groups and require an exact name match
 * that is a member of Only on Stake and/or New Releases.
 */
export async function resolveStakeSlotLive(
  slotName: string,
): Promise<StakeSlot | null> {
  const groups = await resolveGroupIds();
  const hits: Array<GameHit & { source: StakeSlotSource }> = [];

  for (const group of groups) {
    const results = await searchGroupGames(slotName, group);
    for (const hit of results) {
      hits.push({ ...hit, source: group.source });
    }
  }

  const matched = pickExactLiveMatch(slotName, hits);
  if (matched) {
    // Keep catalog warm with discoveries
    const existing = catalog.byNormalizedName.get(normalizeSlotKey(matched.name));
    if (!existing) {
      const nextSlots = [...catalog.slots, matched];
      rebuildIndexes(nextSlots);
    } else if (
      matched.sources.some((s) => !existing.sources.includes(s))
    ) {
      for (const s of matched.sources) {
        if (!existing.sources.includes(s)) existing.sources.push(s);
      }
    }
  }

  return matched;
}

/**
 * Validate a viewer-typed slot name against Only on Stake / New Releases.
 * Uses the local catalog when warm, otherwise (or on miss) live Stake GraphQL.
 */
export async function resolveAllowedStakeSlot(
  slotName: string,
): Promise<{ ok: true; slot: StakeSlot } | { ok: false; reason: string }> {
  const trimmed = slotName.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!trimmed) {
    return { ok: false, reason: "Include a slot name after !s" };
  }

  ensureStakeSlotCatalog();

  const cacheKey = normalizeSlotKey(trimmed);
  const cached = lookupCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    if (cached.slot) return { ok: true, slot: cached.slot };
    return {
      ok: false,
      reason:
        "Slot must be from Stake Only on Stake or New Releases (exact name)",
    };
  }

  const fromCatalog = findInCatalog(trimmed);
  if (fromCatalog) {
    lookupCache.set(cacheKey, {
      slot: fromCatalog,
      expiresAt: Date.now() + POSITIVE_CACHE_MS,
    });
    return { ok: true, slot: fromCatalog };
  }

  try {
    const live = await resolveStakeSlotLive(trimmed);
    lookupCache.set(cacheKey, {
      slot: live,
      expiresAt: Date.now() + (live ? POSITIVE_CACHE_MS : NEGATIVE_CACHE_MS),
    });

    if (live) return { ok: true, slot: live };

    return {
      ok: false,
      reason:
        "Slot must be from Stake Only on Stake or New Releases (exact name)",
    };
  } catch {
    // If Stake is unreachable and catalog is empty, fail closed with a clear message
    if (catalog.slots.length === 0) {
      return {
        ok: false,
        reason: "Could not verify slot against Stake right now — try again",
      };
    }
    return {
      ok: false,
      reason:
        "Slot must be from Stake Only on Stake or New Releases (exact name)",
    };
  }
}

export function getStakeSlotCatalogSummary() {
  const counts = {
    total: catalog.slots.length,
    onlyOnStake: catalog.slots.filter((s) =>
      s.sources.includes("only-on-stake"),
    ).length,
    newReleases: catalog.slots.filter((s) =>
      s.sources.includes("new-releases"),
    ).length,
  };

  return {
    counts,
    expectedCounts: catalog.expectedCounts,
    updatedAt: catalog.updatedAt,
    nextRefreshAt: getCatalogNextRefreshAt(),
    refreshIntervalSeconds: REFRESH_INTERVAL_MS / 1000,
    refreshing: catalog.refreshing,
    lastError: catalog.lastError,
    sources: [
      {
        slug: "only-on-stake",
        name: "Only on Stake",
        url: "https://stake.com/casino/group/only-on-stake",
      },
      {
        slug: "new-releases",
        name: "New Releases",
        url: "https://stake.com/casino/group/new-releases",
      },
    ],
  };
}
