"use client";

import { useCallback, useEffect, useState } from "react";
import {
  messageMatchesGiveawayKeyword,
  type GiveawayState,
} from "@/lib/giveaway";
import { useKickChat } from "@/hooks/useKickChat";
import styles from "./GiveawayPanel.module.css";

const ADMIN_TOKEN_KEY = "blakjac21-guess-admin-token";

async function fetchState(): Promise<GiveawayState> {
  const res = await fetch("/api/giveaway", { cache: "no-store" });
  return (await res.json()) as GiveawayState;
}

export function GiveawayPanel() {
  const [state, setState] = useState<GiveawayState | null>(null);
  const [chatroomId, setChatroomId] = useState<number | null>(null);
  const [adminToken, setAdminToken] = useState(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? "";
  });
  const [keywordDraft, setKeywordDraft] = useState("");
  const [showAdmin, setShowAdmin] = useState(true);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const entriesOpen = state?.entriesOpen ?? false;
  const keyword = state?.keyword?.trim() ?? "";
  const chatConnected = Boolean(entriesOpen && chatroomId && keyword);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const next = await fetchState();
        if (cancelled) return;
        setState(next);
        setKeywordDraft((current) =>
          current.trim() ? current : next.keyword || "",
        );
      } catch {
        /* ignore */
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
      if (!entriesOpen || !keyword) return;
      if (!messageMatchesGiveawayKeyword(message.content, keyword)) return;

      try {
        const res = await fetch("/api/giveaway/entry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: message.username,
            message: message.content,
          }),
        });
        if (res.ok) {
          const next = (await res.json()) as GiveawayState;
          setState(next);
        }
      } catch {
        /* ignore */
      }
    },
    [entriesOpen, keyword],
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

      const next = (await res.json()) as GiveawayState;
      setState(next);
      if (next.keyword) setKeywordDraft(next.keyword);
      return true;
    } catch {
      setAdminError("Could not reach server");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveKeyword() {
    const next = keywordDraft.trim();
    if (!next) {
      setAdminError("Type a keyword first");
      return;
    }
    await adminRequest("/api/giveaway/toggle", "POST", { keyword: next });
  }

  async function toggleEntries(open: boolean) {
    const nextKeyword = keywordDraft.trim() || keyword;
    if (open && !nextKeyword) {
      setAdminError("Type a keyword before opening entries");
      return;
    }
    await adminRequest("/api/giveaway/toggle", "POST", {
      keyword: nextKeyword,
      open,
    });
  }

  async function clearEntries() {
    await adminRequest("/api/giveaway/clear", "POST");
  }

  const entries = [...(state?.entries ?? [])].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  return (
    <div className={styles.wrap}>
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
            : "Set a keyword and open entries to capture chat"}
        </span>
      </div>

      <div className={styles.keywordPublic}>
        <p className={styles.keywordLabel}>Chat keyword</p>
        {keyword ? (
          <p className={styles.keywordValue}>
            Type <code>{keyword}</code> in Kick chat to enter
          </p>
        ) : (
          <p className={styles.keywordEmpty}>
            No keyword set yet — streamer controls below.
          </p>
        )}
      </div>

      <div className={styles.entryList} aria-live="polite">
        <p className={styles.entryHeading}>Entrants ({entries.length})</p>
        {entries.length === 0 ? (
          <p className={styles.empty}>No entries yet.</p>
        ) : (
          <ul className={styles.entryItems}>
            {entries.map((entry, index) => (
              <li key={entry.id} className={styles.entryItem}>
                <span className={styles.entryRank}>{index + 1}</span>
                <span className={styles.entryUser}>{entry.username}</span>
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
          <span
            className={styles.adminChevron}
            data-open={showAdmin || undefined}
          />
        </button>

        {showAdmin ? (
          <div className={styles.adminPanel}>
            <label className={styles.label}>
              Entry keyword
              <input
                className={styles.input}
                type="text"
                value={keywordDraft}
                onChange={(e) => setKeywordDraft(e.target.value)}
                placeholder="e.g. BLAKJAC or !enter"
                autoComplete="off"
                spellCheck={false}
                maxLength={64}
              />
            </label>

            <label className={styles.label}>
              Admin token
              <input
                className={styles.input}
                type="text"
                value={adminToken}
                onChange={(e) => setAdminToken(e.target.value)}
                placeholder="Paste GUESS_ADMIN_TOKEN from .env.local"
                autoComplete="off"
                spellCheck={false}
              />
            </label>

            <div className={styles.adminActions}>
              <button
                type="button"
                className={styles.adminBtnSecondary}
                disabled={busy || !keywordDraft.trim()}
                onClick={saveKeyword}
              >
                Save keyword
              </button>
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
                onClick={clearEntries}
              >
                Clear entrants
              </button>
            </div>

            {adminError ? (
              <p className={styles.adminError} role="alert">
                {adminError}
              </p>
            ) : null}
            <p className={styles.adminHint}>
              Viewers must type the keyword exactly in Kick chat (not
              case-sensitive). One entry per username. Uses the same{" "}
              <code>GUESS_ADMIN_TOKEN</code> as Guess the Balance.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
