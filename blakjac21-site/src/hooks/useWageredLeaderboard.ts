"use client";

import { useEffect, useState } from "react";
import type { WageredLeaderboardData } from "@/lib/wagered-leaderboard";

const REFRESH_MS = 60_000;

export function useWageredLeaderboard() {
  const [data, setData] = useState<WageredLeaderboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function load() {
      try {
        const res = await fetch("/api/leaderboard/wagered", { cache: "no-store" });
        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          throw new Error(body.error ?? "Could not load leaderboard");
        }

        const next = (await res.json()) as WageredLeaderboardData;
        if (!cancelled) {
          setData(next);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load leaderboard",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          timer = setTimeout(load, REFRESH_MS);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return { data, error, loading };
}
