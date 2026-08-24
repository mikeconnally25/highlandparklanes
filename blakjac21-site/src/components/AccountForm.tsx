"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState, type FormEvent } from "react";
import styles from "./AccountForm.module.css";

function AccountFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "login" ? "login" : "register";
  const [mode, setMode] = useState<"register" | "login">(initialMode);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const title = useMemo(
    () => (mode === "login" ? "Sign in" : "Create account"),
    [mode],
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          username,
          email,
          password,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Request failed");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.lead}>
        {mode === "login"
          ? "Welcome back — sign in to your Blakjac21 account."
          : "Make an account for the site to save your spot in the community."}
      </p>

      <form className={styles.form} onSubmit={onSubmit}>
        {mode === "register" ? (
          <label className={styles.label}>
            Username
            <input
              className={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              spellCheck={false}
              required
              minLength={3}
              maxLength={24}
              pattern="[A-Za-z0-9_]+"
              placeholder="your_name"
            />
          </label>
        ) : null}

        <label className={styles.label}>
          Email
          <input
            className={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            placeholder="you@email.com"
          />
        </label>

        <label className={styles.label}>
          Password
          <input
            className={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={6}
            placeholder="At least 6 characters"
          />
        </label>

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <button className={styles.submit} type="submit" disabled={busy}>
          {busy
            ? "Please wait…"
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>

      <p className={styles.switch}>
        {mode === "login" ? (
          <>
            Need an account?{" "}
            <button
              type="button"
              className={styles.switchBtn}
              onClick={() => {
                setMode("register");
                setError(null);
              }}
            >
              Create one
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              className={styles.switchBtn}
              onClick={() => {
                setMode("login");
                setError(null);
              }}
            >
              Sign in
            </button>
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
