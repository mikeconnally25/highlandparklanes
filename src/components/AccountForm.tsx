"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./AccountForm.module.css";

type SessionKickInfo = {
  kickConfigured?: boolean;
  kickMissing?: string[];
  kickRedirectUri?: string | null;
  isAdmin?: boolean;
};

function AccountFormInner() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") === "login" ? "login" : "register";
  const queryError = searchParams.get("error");
  const [kickConfigured, setKickConfigured] = useState<boolean | null>(null);
  const [kickMissing, setKickMissing] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [callbackHint, setCallbackHint] = useState(
    "https://YOUR_DOMAIN/api/account/kick/callback",
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/account/session", { cache: "no-store" });
        const data = (await res.json()) as SessionKickInfo;
        if (cancelled) return;
        setKickConfigured(Boolean(data.kickConfigured));
        setKickMissing(Array.isArray(data.kickMissing) ? data.kickMissing : []);
        setIsAdmin(Boolean(data.isAdmin));
        setCallbackHint(
          data.kickRedirectUri ||
            `${window.location.origin}/api/account/kick/callback`,
        );
      } catch {
        if (!cancelled) {
          setKickConfigured(false);
          setKickMissing(["KICK_CLIENT_ID", "KICK_CLIENT_SECRET"]);
          setCallbackHint(
            `${window.location.origin}/api/account/kick/callback`,
          );
        }
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

      {kickConfigured === false && isAdmin ? (
        <div className={styles.setup} role="alert">
          <p className={styles.setupTitle}>Streamer setup required</p>
          <p className={styles.setupLead}>
            Viewers cannot sign in until you add Kick OAuth credentials to
            Vercel. Takes a few minutes:
          </p>
          <ol className={styles.setupList}>
            <li>
              Open{" "}
              <a
                className={styles.setupLink}
                href="https://kick.com/settings/developer"
                target="_blank"
                rel="noopener noreferrer"
              >
                kick.com/settings/developer
              </a>{" "}
              while logged into your Kick account.
            </li>
            <li>
              Create an app. Add this exact Redirect URL:{" "}
              <code className={styles.setupCode}>{callbackHint}</code>
            </li>
            <li>
              Request scope <code className={styles.setupCode}>user:read</code>.
              Copy the Client ID and Client Secret.
            </li>
            <li>
              In Vercel → your project →{" "}
              <strong>Settings → Environment Variables</strong>, add then
              redeploy:
              {kickMissing.length > 0 ? (
                <ul className={styles.missingList}>
                  {kickMissing.map((name) => (
                    <li key={name}>
                      <code className={styles.setupCode}>{name}</code>
                    </li>
                  ))}
                  <li>
                    <code className={styles.setupCode}>SESSION_SECRET</code>
                  </li>
                </ul>
              ) : (
                <ul className={styles.missingList}>
                  <li>
                    <code className={styles.setupCode}>KICK_CLIENT_ID</code>
                  </li>
                  <li>
                    <code className={styles.setupCode}>KICK_CLIENT_SECRET</code>
                  </li>
                  <li>
                    <code className={styles.setupCode}>SESSION_SECRET</code>
                  </li>
                </ul>
              )}
            </li>
            <li>
              Reload this page — <strong>Continue with Kick</strong> will unlock
              for everyone.
            </li>
          </ol>
        </div>
      ) : null}

      {kickConfigured === false && !isAdmin ? (
        <p className={styles.error} role="alert">
          Kick sign-in is not set up on this site yet. The streamer needs to
          connect a Kick developer app — check back soon.
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
