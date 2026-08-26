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
  isAdmin?: boolean;
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

function normalizeUser(
  user: PublicSiteUser | null | undefined,
  isAdminFlag?: boolean,
): PublicSiteUser | null {
  if (!user) return null;
  return {
    ...user,
    isAdmin: Boolean(user.isAdmin || isAdminFlag),
  };
}

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
      setUser(normalizeUser(data.user, data.isAdmin));
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
        if (!cancelled) setUser(normalizeUser(data.user, data.isAdmin));
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
