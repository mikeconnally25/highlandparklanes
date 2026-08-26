"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicSiteUser } from "@/lib/site-auth";

type SessionPayload = {
  user?: PublicSiteUser | null;
  kickConfigured?: boolean;
};

export function useSiteSession() {
  const [user, setUser] = useState<PublicSiteUser | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/account/session", { cache: "no-store" });
      const data = (await res.json()) as SessionPayload;
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/account/session", { cache: "no-store" });
        const data = (await res.json()) as SessionPayload;
        if (!cancelled) setUser(data.user ?? null);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    load();
    const onFocus = () => {
      void load();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/account/session", { method: "DELETE" });
    } catch {
      /* ignore */
    }
    setUser(null);
  }, []);

  return {
    user,
    ready,
    isAdmin: Boolean(user?.isAdmin),
    refresh,
    signOut,
  };
}
