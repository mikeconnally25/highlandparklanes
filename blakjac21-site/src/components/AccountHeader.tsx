"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PublicSiteUser } from "@/lib/site-auth";
import styles from "./AccountHeader.module.css";

export function AccountHeader() {
  const [user, setUser] = useState<PublicSiteUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/account/session", { cache: "no-store" });
        const data = (await res.json()) as { user?: PublicSiteUser | null };
        if (!cancelled) setUser(data.user ?? null);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function signOut() {
    try {
      await fetch("/api/account/session", { method: "DELETE" });
    } catch {
      /* ignore */
    }
    setUser(null);
  }

  if (!ready) {
    return <div className={styles.slot} aria-hidden />;
  }

  if (user) {
    return (
      <div className={styles.slot}>
        <span className={styles.username}>@{user.username}</span>
        <button type="button" className={styles.ghostBtn} onClick={signOut}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className={styles.slot}>
      <Link className={styles.signIn} href="/account?mode=login">
        Sign in
      </Link>
      <Link className={styles.createBtn} href="/account">
        Create account
      </Link>
    </div>
  );
}
