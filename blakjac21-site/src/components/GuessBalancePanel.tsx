"use client";

import { useCallback, useEffect, useState } from "react";
import type { GuessBalanceState } from "@/lib/guess-balance";
import {
  formatUsd,
  getClosestGuesses,
  parseBalanceGuess,
} from "@/lib/guess-balance";
import { isBalanceGuessMessage, useKickChat } from "@/hooks/useKickChat";
import { useSiteSession } from "@/hooks/useSiteSession";
import styles from "./GuessBalancePanel.module.css";

async function fetchState(): Promise<GuessBalanceState> {
  const res = await fetch("/api/guess/balance", { cache: "no-store" });
  return (await res.json()) as GuessBalanceState;
}

export function GuessBalancePanel({ fullPage = false }: { fullPage?: boolean }) {
  const { isAdmin, ready: sessionReady } = useSiteSession();
  const [state, setState] = useState<GuessBalanceState | null>(null);
  const [chatroomId, setChatroomId] = useState<number | null>(null);
  const [showAdmin, setShowAdmin] = useState(true);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actualBalanceInput, setActualBalanceInput] = useState("");
  const [showClosest, setShowClosest] = useState(false);

  useEffect(() => {
    if (isAdmin) setShowAdmin(true);
    else {
      setActualBalanceInput("");
      setShowClosest(false);
    }
  }, [isAdmin]);

  const canManage = sessionReady && isAdmin;
  const actualBalance = canManage ? parseBalanceGuess(actualBalanceInput) : null;
  const canRevealClosest =
    canManage && actualBalance !== null && (state?.guesses.length ?? 0) > 0;
  const closestGuesses =
    canManage && actualBalance !== null && showClosest
      ? getClosestGuesses(state?.guesses ?? [], actualBalance, 3)
      : [];

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

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setAdminError(
          data.error === "Unauthorized"
            ? "Sign in with the admin Kick account to use streamer controls"
            : (data.error ?? "Admin request failed"),
        );
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
    const cleared = await adminRequest("/api/guess/balance/clear", "POST");
    if (cleared) {
      setActualBalanceInput("");
      setShowClosest(false);
    }
  }

  function handleActualBalanceChange(value: string) {
    if (!canManage) return;
    setActualBalanceInput(value);
    setShowClosest(false);
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

      {canManage ? (
        <div className={styles.reveal}>
          <p className={styles.revealHeading}>Reveal winner</p>
          <label className={styles.label}>
            Actual balance
            <input
              className={styles.input}
              type="text"
              inputMode="decimal"
              value={actualBalanceInput}
              onChange={(e) => handleActualBalanceChange(e.target.value)}
              placeholder="e.g. 1234 or $1,234.50"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          {canRevealClosest ? (
            <button
              type="button"
              className={styles.revealBtn}
              onClick={() => setShowClosest(true)}
            >
              Show 3 closest guesses
            </button>
          ) : null}
          {actualBalanceInput.trim() && actualBalance === null ? (
            <p className={styles.revealHint}>Enter a valid balance amount.</p>
          ) : null}
        </div>
      ) : null}

      {canManage && showClosest && actualBalance !== null ? (
        <div className={styles.closestList} aria-live="polite">
          <p className={styles.guessHeading}>
            Closest to {formatUsd(actualBalance)}
          </p>
          {closestGuesses.length === 0 ? (
            <p className={styles.empty}>No guesses to compare.</p>
          ) : (
            <ul className={`${styles.guessItems} ${fullPage ? styles.guessItemsPage : ""}`}>
              {closestGuesses.map((guess, index) => (
                <li key={guess.id} className={`${styles.guessItem} ${styles.closestItem}`}>
                  <span className={styles.guessRank}>{index + 1}</span>
                  <span className={styles.guessUser}>{guess.username}</span>
                  <span className={styles.closestMeta}>
                    <span className={styles.guessAmount}>{formatUsd(guess.amount)}</span>
                    <span className={styles.guessDiff}>
                      off by {formatUsd(guess.difference)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

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

      {canManage ? (
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
                Signed in as admin via Kick. Open or close entries during stream.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
