"use client";

import { useEffect, useState } from "react";
import { ActiveHuntPanel } from "@/components/ActiveHuntPanel";
import { HuntBoardProvider } from "@/components/HuntBoardContext";
import { PastHuntsPanel } from "@/components/PastHuntsPanel";
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
