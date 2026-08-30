"use client";

import { useEffect, useState } from "react";
import { HuntLiveBoard } from "@/components/bonus-hunt/HuntLiveBoard";
import { HuntBoardProvider } from "@/components/HuntBoardContext";
import type { PastHuntResult } from "@/lib/bonus-hunt";
import { PastHuntsPanel } from "@/components/PastHuntsPanel";
import {
  HUNT_HISTORY_EVENT,
  preferPastHunts,
  readHuntHistoryCache,
} from "@/lib/hunt-client-sync";
import styles from "./BonusHuntsBoard.module.css";

function BonusHuntsBoardInner() {
  const [pastOpen, setPastOpen] = useState(false);
  const [pastCount, setPastCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const historyRes = await fetch("/api/bonus-hunt/history", {
          cache: "no-store",
        });
        if (historyRes.ok) {
          const data = (await historyRes.json()) as { hunts?: PastHuntResult[] };
          const merged = preferPastHunts(
            readHuntHistoryCache(),
            data.hunts ?? [],
          );
          if (!cancelled) setPastCount(merged.length);
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
    window.addEventListener(HUNT_HISTORY_EVENT, onHistory);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener(HUNT_HISTORY_EVENT, onHistory);
    };
  }, []);

  return (
    <div className={styles.shell}>
      <HuntLiveBoard />

      <section className={styles.archive} aria-labelledby="past-hunts-heading">
        <button
          type="button"
          id="past-hunts-heading"
          className={styles.archiveToggle}
          aria-expanded={pastOpen}
          onClick={() => setPastOpen((open) => !open)}
        >
          <span className={styles.archiveTitle}>
            Past hunts{pastCount > 0 ? ` · ${pastCount}` : ""}
          </span>
          <span className={styles.archiveHint}>
            Saved when you press End hunt
          </span>
          <span
            className={styles.archiveChevron}
            data-open={pastOpen || undefined}
            aria-hidden
          />
        </button>
        {pastOpen ? (
          <div className={styles.archiveBody}>
            <PastHuntsPanel />
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function BonusHuntsBoard() {
  return (
    <HuntBoardProvider>
      <BonusHuntsBoardInner />
    </HuntBoardProvider>
  );
}
