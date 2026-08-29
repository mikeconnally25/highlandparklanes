"use client";

import { useEffect, useState } from "react";
import { ActiveHuntPanel } from "@/components/ActiveHuntPanel";
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
    <div className={styles.wrap}>
      <ActiveHuntPanel />

      <section className={styles.past} aria-labelledby="past-hunts">
        <button
          type="button"
          id="past-hunts"
          className={styles.pastToggle}
          aria-expanded={pastOpen}
          onClick={() => setPastOpen((open) => !open)}
        >
          <span className={styles.pastTitle}>
            Past hunts{pastCount > 0 ? ` · ${pastCount}` : ""}
          </span>
          <span className={styles.pastHint}>Archived after End hunt</span>
          <span
            className={styles.pastChevron}
            data-open={pastOpen || undefined}
            aria-hidden
          />
        </button>
        {pastOpen ? (
          <div className={styles.pastBody}>
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
