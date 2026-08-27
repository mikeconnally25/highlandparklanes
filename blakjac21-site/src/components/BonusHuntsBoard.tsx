"use client";

import { useEffect, useState } from "react";
import { ActiveHuntPanel } from "@/components/ActiveHuntPanel";
import {
  HuntBoardProvider,
  useHuntBoardState,
} from "@/components/HuntBoardContext";
import { PastHuntsPanel } from "@/components/PastHuntsPanel";
import { useSiteSession } from "@/hooks/useSiteSession";
import type { BonusHuntState } from "@/lib/bonus-hunt";
import { readHuntCache } from "@/lib/hunt-client-sync";
import styles from "@/app/bonus-hunts/page.module.css";

function labelFromState(state: BonusHuntState | null | undefined): string {
  const title = state?.title?.trim() ?? "";
  if (title) return `Active hunt · ${title}`;
  if (state?.huntActive) return "Active hunt";
  return "Active hunt · idle";
}

function BonusHuntsBoardInner() {
  const { isAdmin } = useSiteSession();
  const showAdminHint = isAdmin;
  const board = useHuntBoardState();
  const [activeOpen, setActiveOpen] = useState(true);
  const [pastOpen, setPastOpen] = useState(false);
  const [activeLabel, setActiveLabel] = useState(() =>
    labelFromState(readHuntCache()),
  );
  const [pastCount, setPastCount] = useState(0);

  // Prefer the live published board (includes hunt # typed in the panel).
  useEffect(() => {
    if (!board) return;
    setActiveLabel(labelFromState(board));
  }, [board]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [stateRes, historyRes] = await Promise.all([
          fetch("/api/bonus-hunt", { cache: "no-store" }),
          fetch("/api/bonus-hunt/history", { cache: "no-store" }),
        ]);
        if (stateRes.ok) {
          const state = (await stateRes.json()) as BonusHuntState;
          if (!cancelled) {
            // Don't let a colder/empty server wipe a live typed title.
            const liveTitle = board?.title?.trim() ?? "";
            const remoteTitle = state.title.trim();
            if (liveTitle && !remoteTitle) {
              setActiveLabel(labelFromState(board));
            } else {
              setActiveLabel(labelFromState(state));
            }
          }
        }
        if (historyRes.ok) {
          const data = (await historyRes.json()) as { hunts?: unknown[] };
          if (!cancelled) setPastCount(data.hunts?.length ?? 0);
        }
      } catch {
        /* ignore */
      }
    }

    load();
    const timer = setInterval(load, 4000);
    const onHistory = () => {
      void load();
      setPastOpen(true);
    };
    window.addEventListener("bonus-hunt-history-changed", onHistory);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("bonus-hunt-history-changed", onHistory);
    };
  }, [board]);

  return (
    <>
      <section className={styles.section} aria-labelledby="active-hunt">
        <button
          type="button"
          id="active-hunt"
          className={styles.dropdownToggle}
          aria-expanded={activeOpen}
          onClick={() => setActiveOpen((open) => !open)}
        >
          <span className={styles.dropdownTitle}>{activeLabel}</span>
          <span className={styles.dropdownHint}>
            {showAdminHint
              ? "Live board, chat requests, streamer controls"
              : "Live board and chat requests"}
          </span>
          <span
            className={styles.dropdownChevron}
            data-open={activeOpen || undefined}
            aria-hidden
          />
        </button>

        <div
          className={activeOpen ? styles.dropdownBody : styles.dropdownBodyHidden}
          aria-hidden={activeOpen ? undefined : true}
        >
          <div className={styles.card}>
            <ActiveHuntPanel />
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="past-hunts">
        <button
          type="button"
          id="past-hunts"
          className={styles.dropdownToggle}
          aria-expanded={pastOpen}
          onClick={() => setPastOpen((open) => !open)}
        >
          <span className={styles.dropdownTitle}>
            Past hunt results
            {pastCount > 0 ? ` · ${pastCount}` : ""}
          </span>
          <span className={styles.dropdownHint}>
            Archived boards after you end a hunt
          </span>
          <span
            className={styles.dropdownChevron}
            data-open={pastOpen || undefined}
            aria-hidden
          />
        </button>

        {pastOpen ? (
          <div className={styles.dropdownBody}>
            <div className={styles.card}>
              <PastHuntsPanel />
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}

export function BonusHuntsBoard() {
  return (
    <HuntBoardProvider>
      <BonusHuntsBoardInner />
    </HuntBoardProvider>
  );
}
