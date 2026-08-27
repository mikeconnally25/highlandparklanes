"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GIVEAWAY_CLAIM_KEYWORD,
  messageMatchesGiveawayClaim,
  messageMatchesGiveawayKeyword,
  type GiveawayState,
} from "@/lib/giveaway";
import {
  useKickChatContext,
  useKickChatSubscription,
} from "@/hooks/KickChatProvider";
import { useSiteSession } from "@/hooks/useSiteSession";
import {
  GiveawayWheel,
  rotationForWinner,
} from "@/components/GiveawayWheel";
import styles from "./GiveawayPanel.module.css";
const SPIN_MS = 5500;
const CLAIM_MS = 30_000;
const CHAT_LOG_LIMIT = 80;

type ChatLogLine = {
  id: string;
  username: string;
  content: string;
  at: number;
};

type ClaimPhase = {
  username: string;
  endsAt: number;
  status: "waiting" | "claimed" | "expired";
  claimMessage?: string;
};

async function fetchState(): Promise<GiveawayState> {
  const res = await fetch("/api/giveaway", { cache: "no-store" });
  return (await res.json()) as GiveawayState;
}

export function GiveawayPanel() {
  const { isAdmin, ready: sessionReady } = useSiteSession();
  const { chatroomId, connectionState } = useKickChatContext();
  const [state, setState] = useState<GiveawayState | null>(null);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [showAdmin, setShowAdmin] = useState(true);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isAdmin) setShowAdmin(true);
  }, [isAdmin]);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [claim, setClaim] = useState<ClaimPhase | null>(null);
  const [claimSecondsLeft, setClaimSecondsLeft] = useState(0);
  const [chatLog, setChatLog] = useState<ChatLogLine[]>([]);
  const spinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const claimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const claimRef = useRef<ClaimPhase | null>(null);
  const finishingClaimRef = useRef(false);

  const entriesOpen = state?.entriesOpen ?? false;
  const keyword = state?.keyword?.trim() ?? "";
  const chatLive = connectionState === "connected" && Boolean(chatroomId);

  useEffect(() => {
    claimRef.current = claim;
  }, [claim]);

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
    return () => {
      if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
      if (claimTimerRef.current) clearTimeout(claimTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!claim || claim.status !== "waiting") {
      setClaimSecondsLeft(0);
      return;
    }

    function tick() {
      const left = Math.max(
        0,
        Math.ceil((claim!.endsAt - Date.now()) / 1000),
      );
      setClaimSecondsLeft(left);
    }

    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [claim]);

  async function removeWinner(username: string) {
    try {
      const res = await fetch("/api/giveaway/remove", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username }),
      });
      if (res.ok) {
        const next = (await res.json()) as GiveawayState;
        setState(next);
        return true;
      }
      setState((current) => {
        if (!current) return current;
        return {
          ...current,
          entries: current.entries.filter(
            (entry) => entry.username !== username.toLowerCase(),
          ),
          updatedAt: new Date().toISOString(),
        };
      });
      return false;
    } catch {
      setState((current) => {
        if (!current) return current;
        return {
          ...current,
          entries: current.entries.filter(
            (entry) => entry.username !== username.toLowerCase(),
          ),
          updatedAt: new Date().toISOString(),
        };
      });
      return false;
    }
  }

  const finishClaim = useCallback(
    async (
      username: string,
      status: "claimed" | "expired",
      claimMessage?: string,
    ) => {
      if (finishingClaimRef.current) return;
      finishingClaimRef.current = true;
      if (claimTimerRef.current) {
        clearTimeout(claimTimerRef.current);
        claimTimerRef.current = null;
      }

      setClaim({
        username,
        endsAt: Date.now(),
        status,
        claimMessage,
      });
      await removeWinner(username);
      setWinner(username);
      finishingClaimRef.current = false;
    },
    [],
  );

  const startClaimWindow = useCallback(
    (username: string) => {
      finishingClaimRef.current = false;
      if (claimTimerRef.current) clearTimeout(claimTimerRef.current);

      const endsAt = Date.now() + CLAIM_MS;
      setClaim({ username, endsAt, status: "waiting" });
      setWinner(username);

      claimTimerRef.current = setTimeout(() => {
        const current = claimRef.current;
        if (
          current &&
          current.username === username &&
          current.status === "waiting"
        ) {
          void finishClaim(username, "expired");
        }
      }, CLAIM_MS);
    },
    [finishClaim],
  );

  const handleChatMessage = useCallback(
    async (message: { username: string; content: string }) => {
      const username = message.username.trim().toLowerCase();
      const content = message.content.trim();
      if (!username || !content) return;

      setChatLog((prev) => {
        const next = [
          ...prev,
          {
            id: `${Date.now()}-${username}-${Math.random().toString(36).slice(2, 7)}`,
            username,
            content,
            at: Date.now(),
          },
        ];
        return next.slice(-CHAT_LOG_LIMIT);
      });

      const activeClaim = claimRef.current;
      if (
        activeClaim &&
        activeClaim.status === "waiting" &&
        activeClaim.username === username &&
        messageMatchesGiveawayClaim(content)
      ) {
        void finishClaim(username, "claimed", content);
        return;
      }

      if (!entriesOpen || !keyword) return;
      if (!messageMatchesGiveawayKeyword(content, keyword)) return;

      try {
        const res = await fetch("/api/giveaway/entry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: message.username,
            message: content,
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
    [entriesOpen, keyword, finishClaim],
  );

  useKickChatSubscription(handleChatMessage);

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
    const ok = await adminRequest("/api/giveaway/clear", "POST");
    if (ok) {
      setWinner(null);
      setSpinning(false);
      setClaim(null);
      if (claimTimerRef.current) {
        clearTimeout(claimTimerRef.current);
        claimTimerRef.current = null;
      }
    }
  }

  function rollWinner() {
    const list = [...(state?.entries ?? [])].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    if (list.length === 0 || spinning || claim?.status === "waiting") return;

    const index = Math.floor(Math.random() * list.length);
    const picked = list[index];
    setWinner(null);
    setClaim(null);
    setSpinning(true);
    setRotationDeg((current) =>
      rotationForWinner(index, list.length, current),
    );

    if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
    spinTimerRef.current = setTimeout(() => {
      setSpinning(false);
      spinTimerRef.current = null;
      startClaimWindow(picked.username);
    }, SPIN_MS);
  }

  const entries = [...(state?.entries ?? [])].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const names = entries.map((entry) => entry.username);
  const claimUsername = claim?.username ?? winner;
  const winnerLogs = claimUsername
    ? chatLog.filter((line) => line.username === claimUsername)
    : [];
  const claiming = claim?.status === "waiting";

  return (
    <div className={styles.layout}>
      <div className={styles.left}>
        <div className={styles.statusRow}>
          <span
            className={`${styles.statusBadge} ${entriesOpen ? styles.statusOpen : styles.statusClosed}`}
          >
            {entriesOpen ? "Entries open" : "Entries closed"}
          </span>
          <span className={styles.chatStatus}>
            {!chatroomId
              ? "Loading Kick chatroom…"
              : chatLive
                ? entriesOpen
                  ? "Kick chat live — listening for giveaway keyword"
                  : "Kick chat live — open entries to capture keyword"
                : connectionState === "connecting"
                  ? "Connecting to Kick chat…"
                  : connectionState === "error"
                    ? "Kick chat reconnecting…"
                    : "Waiting for Kick chat…"}
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
                <li
                  key={entry.id}
                  className={`${styles.entryItem} ${claimUsername === entry.username ? styles.entryWinner : ""}`}
                >
                  <span className={styles.entryRank}>{index + 1}</span>
                  <span className={styles.entryUser}>{entry.username}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {sessionReady && isAdmin ? (
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
                Signed in as admin via Kick. Viewers enter with the keyword, then
                winners type <code>{GIVEAWAY_CLAIM_KEYWORD}</code> in Kick chat
                within 30s to claim.
              </p>
            </div>
          ) : null}
        </div>
        ) : null}
      </div>

      <aside className={styles.right} aria-label="Winner wheel">
        {sessionReady && isAdmin ? (
          <button
            type="button"
            className={styles.rollBtn}
            disabled={entries.length === 0 || spinning || claiming}
            onClick={rollWinner}
          >
            {spinning ? "Rolling…" : claiming ? "Awaiting claim…" : "Roll winner"}
          </button>
        ) : null}
        <GiveawayWheel
          names={names}
          rotationDeg={rotationDeg}
          spinning={spinning}
          winner={claimUsername}
        />
      </aside>

      {claim || (winner && !spinning) ? (
        <aside className={styles.claimPanel} aria-live="polite">
          <p className={styles.claimEyebrow}>Claim window</p>
          <h2 className={styles.claimTitle}>@{claimUsername}</h2>

          {claim?.status === "waiting" ? (
            <>
              <p className={styles.claimTimer}>
                <span className={styles.claimSeconds}>{claimSecondsLeft}</span>
                s to claim
              </p>
              <p className={styles.claimHint}>
                Type <code>{GIVEAWAY_CLAIM_KEYWORD}</code> or{" "}
                <code>!{GIVEAWAY_CLAIM_KEYWORD}</code> in Kick chat
              </p>
            </>
          ) : null}

          {claim?.status === "claimed" ? (
            <p className={styles.claimSuccess}>
              Claimed with <code>{claim.claimMessage}</code> — removed from
              giveaway
            </p>
          ) : null}

          {claim?.status === "expired" ? (
            <p className={styles.claimExpired}>
              Time expired — removed from giveaway
            </p>
          ) : null}

          <div className={styles.chatLog}>
            <p className={styles.chatLogHeading}>Their Kick chat</p>
            {winnerLogs.length === 0 ? (
              <p className={styles.empty}>
                No messages from this user yet. Keep this page open to catch
                chat.
              </p>
            ) : (
              <ul className={styles.chatLogItems}>
                {winnerLogs.map((line) => (
                  <li key={line.id} className={styles.chatLogItem}>
                    <span className={styles.chatLogTime}>
                      {new Date(line.at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                    <span className={styles.chatLogText}>{line.content}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
