"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PublicSiteUser } from "@/lib/site-auth";

type SessionPayload = {
  user?: PublicSiteUser | null;
  kickConfigured?: boolean;
};

type SiteSessionValue = {
  user: PublicSiteUser | null;
  ready: boolean;
  isAdmin: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SiteSessionContext = createContext<SiteSessionValue | null>(null);

export function SiteSessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicSiteUser | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/account/session", {
        cache: "no-store",
        credentials: "same-origin",
      });
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
        const res = await fetch("/api/account/session", {
          cache: "no-store",
          credentials: "same-origin",
        });
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
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/account/session", {
        method: "DELETE",
        credentials: "same-origin",
      });
    } catch {
      /* ignore */
    }
    setUser(null);
  }, []);

  const value = useMemo<SiteSessionValue>(
    () => ({
      user,
      ready,
      isAdmin: Boolean(user?.isAdmin),
      refresh,
      signOut,
    }),
    [user, ready, refresh, signOut],
  );

  return (
    <SiteSessionContext.Provider value={value}>
      {children}
    </SiteSessionContext.Provider>
  );
}

export function useSiteSession(): SiteSessionValue {
  const ctx = useContext(SiteSessionContext);
  if (!ctx) {
    throw new Error("useSiteSession must be used within SiteSessionProvider");
  }
  return ctx;
}
