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
import styles from "@/app/bonus-hunts/page.module.css";

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
    <>
      <section className={styles.section} aria-label="Active hunt">
        <div className={styles.card}>
          <ActiveHuntPanel />
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
