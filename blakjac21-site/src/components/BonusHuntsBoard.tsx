"use client";

import { useEffect, useState } from "react";
import { ActiveHuntPanel } from "@/components/ActiveHuntPanel";
import { BonusOverlayWidget } from "@/components/BonusOverlayWidget";
import { HuntBoardProvider } from "@/components/HuntBoardContext";
import { ObsOverlayLink } from "@/components/ObsOverlayLink";
import { PastHuntsPanel } from "@/components/PastHuntsPanel";
import { useSiteSession } from "@/hooks/useSiteSession";
import type { BonusHuntState } from "@/lib/bonus-hunt";
import styles from "@/app/bonus-hunts/page.module.css";

export function BonusHuntsBoard() {
  const { isAdmin, ready: sessionReady } = useSiteSession();
  const showObs = isAdmin;
  const [activeOpen, setActiveOpen] = useState(true);
  const [pastOpen, setPastOpen] = useState(false);
  const [activeLabel, setActiveLabel] = useState("Active hunt");
  const [pastCount, setPastCount] = useState(0);

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
            const title = state.title.trim();
            setActiveLabel(
              title
                ? `Active hunt · ${title}`
                : state.huntActive
                  ? "Active hunt"
                  : "Active hunt · idle",
            );
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
  }, []);

  return (
    <HuntBoardProvider>
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
            {showObs
              ? "Live board, chat requests, OBS widget"
              : "Live board and chat requests"}
          </span>
          <span
            className={styles.dropdownChevron}
            data-open={activeOpen || undefined}
            aria-hidden
          />
        </button>

        {activeOpen ? (
          <div className={styles.dropdownBody}>
            <div
              className={styles.huntLayout}
              data-admin={showObs || undefined}
            >
              <div className={styles.card}>
                <ActiveHuntPanel />
              </div>
              {sessionReady && showObs ? (
                <aside
                  className={styles.widgetColumn}
                  aria-label="OBS bonus widget preview"
                >
                  <p className={styles.widgetLabel}>OBS widget preview</p>
                  <BonusOverlayWidget mode="preview" />
                  <ObsOverlayLink />
                </aside>
              ) : null}
            </div>
          </div>
        ) : null}
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
    </HuntBoardProvider>
  );
}
