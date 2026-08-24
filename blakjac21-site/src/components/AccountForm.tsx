"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./AccountForm.module.css";

function AccountFormInner() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") === "login" ? "login" : "register";
  const queryError = searchParams.get("error");
  const [kickConfigured, setKickConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/account/session", { cache: "no-store" });
        const data = (await res.json()) as { kickConfigured?: boolean };
        if (!cancelled) setKickConfigured(Boolean(data.kickConfigured));
      } catch {
        if (!cancelled) setKickConfigured(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const title = mode === "login" ? "Sign in with Kick" : "Create account with Kick";

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.lead}>
        Accounts on this site are tied to your Kick profile. Continue with Kick
        to create an account or sign in — no password on this site.
      </p>

      {queryError ? (
        <p className={styles.error} role="alert">
          {queryError}
        </p>
      ) : null}

      {kickConfigured === false ? (
        <p className={styles.error} role="alert">
          Kick login is not configured yet. Add{" "}
          <code>KICK_CLIENT_ID</code>, <code>KICK_CLIENT_SECRET</code>, and{" "}
          <code>KICK_REDIRECT_URI</code> (or <code>NEXT_PUBLIC_SITE_URL</code>)
          in the server environment, then register the callback URL in the Kick
          Developer Portal.
        </p>
      ) : null}

      <a
        className={styles.kickBtn}
        href="/api/account/kick"
        aria-disabled={kickConfigured === false || undefined}
        onClick={(event) => {
          if (kickConfigured === false) event.preventDefault();
        }}
      >
        Continue with Kick
      </a>

      <p className={styles.switch}>
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link className={styles.switchLink} href="/account">
              Create account with Kick
            </Link>
          </>
        ) : (
          <>
            Already joined?{" "}
            <Link className={styles.switchLink} href="/account?mode=login">
              Sign in with Kick
            </Link>
          </>
        )}
      </p>

      <Link className={styles.homeLink} href="/">
        ← Back home
      </Link>
    </div>
  );
}

export function AccountForm() {
  return (
    <Suspense fallback={<div className={styles.wrap}>Loading…</div>}>
      <AccountFormInner />
    </Suspense>
  );
}
