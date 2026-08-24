"use client";

import { useCallback, useEffect, useState } from "react";
import type { GuessBalanceState } from "@/lib/guess-balance";
import { formatUsd } from "@/lib/guess-balance";
import { isBalanceGuessMessage, useKickChat } from "@/hooks/useKickChat";
import styles from "./GuessBalancePanel.module.css";

const ADMIN_TOKEN_KEY = "blakjac21-guess-admin-token";

async function fetchState(): Promise<GuessBalanceState> {
  const res = await fetch("/api/guess/balance", { cache: "no-store" });
  return (await res.json()) as GuessBalanceState;
}

export function GuessBalancePanel({ fullPage = false }: { fullPage?: boolean }) {
  const [state, setState] = useState<GuessBalanceState | null>(null);
  const [chatroomId, setChatroomId] = useState<number | null>(null);
  const [adminToken, setAdminToken] = useState(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? "";
  });
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const entriesOpen = state?.entriesOpen ?? false;
  const chatConnected = Boolean(entriesOpen && chatroomId);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const next = await fetchState();
        if (!cancelled) setState(next);
      } catch {
        /* ignore transient errors */
      }
    }

    load();
    const timer = setInterval(load, 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadChatroom() {
      try {
        const res = await fetch("/api/kick/chatroom", { cache: "no-store" });
        const data = (await res.json()) as { chatroomId?: number };
        if (!cancelled && data.chatroomId) setChatroomId(data.chatroomId);
      } catch {
        if (!cancelled) setChatroomId(null);
      }
    }

    loadChatroom();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChatMessage = useCallback(
    async (message: { username: string; content: string }) => {
      if (!entriesOpen) return;
      if (!isBalanceGuessMessage(message.content)) return;

      try {
        const res = await fetch("/api/guess/balance/entry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: message.username,
            message: message.content,
          }),
        });
        if (res.ok) {
          const next = (await res.json()) as GuessBalanceState;
          setState(next);
        }
      } catch {
        /* ignore */
      }
    },
    [entriesOpen],
  );

  useKickChat({
    chatroomId,
    enabled: chatConnected,
    onMessage: handleChatMessage,
  });

  async function adminRequest(
    url: string,
    method: "POST",
    body?: object,
  ): Promise<boolean> {
    setAdminError(null);
    setBusy(true);
    sessionStorage.setItem(ADMIN_TOKEN_KEY, adminToken);

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setAdminError(data.error ?? "Admin request failed");
        return false;
      }

      const next = (await res.json()) as GuessBalanceState;
      setState(next);
      return true;
    } catch {
      setAdminError("Could not reach server");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function toggleEntries(open: boolean) {
    await adminRequest("/api/guess/balance/toggle", "POST", { open });
  }

  async function clearGuesses() {
    await adminRequest("/api/guess/balance/clear", "POST");
  }

  const guesses = [...(state?.guesses ?? [])]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, fullPage ? undefined : 15);

  return (
    <div className={`${styles.wrap} ${fullPage ? styles.wrapPage : ""}`}>
      <div className={styles.statusRow}>
        <span
          className={`${styles.statusBadge} ${entriesOpen ? styles.statusOpen : styles.statusClosed}`}
        >
          {entriesOpen ? "Entries open" : "Entries closed"}
        </span>
        <span className={styles.chatStatus}>
          {entriesOpen
            ? chatConnected
              ? "Listening to Kick chat"
              : "Connecting to chat…"
            : "Open entries to capture guesses"}
        </span>
      </div>

      <p className={styles.help}>
        When entries are open, viewers guess in Kick chat with a number like{" "}
        <code>1234</code>, <code>$1,234.50</code>, or <code>!guess 500</code>.
        One guess per username — resubmitting updates your entry.
      </p>

      <div className={styles.guessList} aria-live="polite">
        <p className={styles.guessHeading}>
          {fullPage ? "Results" : "Live guesses"} ({state?.guesses.length ?? 0})
        </p>
        {guesses.length === 0 ? (
          <p className={styles.empty}>No guesses yet.</p>
        ) : (
          <ul className={`${styles.guessItems} ${fullPage ? styles.guessItemsPage : ""}`}>
            {guesses.map((guess, index) => (
              <li key={guess.id} className={styles.guessItem}>
                {fullPage ? (
                  <span className={styles.guessRank}>{index + 1}</span>
                ) : null}
                <span className={styles.guessUser}>{guess.username}</span>
                <span className={styles.guessAmount}>
                  {formatUsd(guess.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.admin}>
        <button
          type="button"
          className={styles.adminToggle}
          aria-expanded={showAdmin}
          onClick={() => setShowAdmin((v) => !v)}
        >
          Streamer controls
          <span className={styles.adminChevron} data-open={showAdmin || undefined} />
        </button>

        {showAdmin ? (
          <div className={styles.adminPanel}>
            <label className={styles.label}>
              Admin token
              <input
                className={styles.input}
                type="password"
                value={adminToken}
                onChange={(e) => setAdminToken(e.target.value)}
                placeholder="Set GUESS_ADMIN_TOKEN"
                autoComplete="off"
              />
            </label>

            <div className={styles.adminActions}>
              <button
                type="button"
                className={styles.adminBtnPrimary}
                disabled={busy || entriesOpen}
                onClick={() => toggleEntries(true)}
              >
                Open entries
              </button>
              <button
                type="button"
                className={styles.adminBtnSecondary}
                disabled={busy || !entriesOpen}
                onClick={() => toggleEntries(false)}
              >
                Close entries
              </button>
              <button
                type="button"
                className={styles.adminBtnSecondary}
                disabled={busy}
                onClick={clearGuesses}
              >
                Clear guesses
              </button>
            </div>

            {adminError ? (
              <p className={styles.adminError} role="alert">
                {adminError}
              </p>
            ) : null}
            <p className={styles.adminHint}>
              Set <code>GUESS_ADMIN_TOKEN</code> in your environment and paste it
              here to open or close entries during stream.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
