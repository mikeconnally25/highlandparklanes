"use client";

import { useEffect, useState } from "react";
import type { KickStatus } from "@/lib/kick";

const POLL_MS = 45_000;

export function useKickStatus() {
  const [status, setStatus] = useState<KickStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function load() {
      try {
        const res = await fetch("/api/kick/status", { cache: "no-store" });
        const data = (await res.json()) as KickStatus;
        if (!cancelled) setStatus(data);
      } catch {
        if (!cancelled) {
          setStatus((prev) =>
            prev ?? {
              slug: "Blakjac21",
              isLive: false,
              title: null,
              viewerCount: null,
              latestVod: null,
              error: "Could not reach Kick status",
            },
          );
        }
      } finally {
        if (!cancelled) timer = setTimeout(load, POLL_MS);
      }
    }

    load();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return status;
}
