"use client";

import { useState } from "react";
import { GuessBalancePanel } from "@/components/GuessBalancePanel";
import styles from "./FeatureTabs.module.css";

type TabId = "balance" | "leaderboard" | "rewards";

const TABS: { id: TabId; label: string }[] = [
  { id: "balance", label: "Guess the Balance" },
  { id: "leaderboard", label: "Leaderboard" },
  { id: "rewards", label: "Rewards" },
];

const PANEL_COPY: Record<Exclude<TabId, "balance">, { title: string; body: string }> = {
  leaderboard: {
    title: "Leaderboard",
    body: "Top viewers and streak holders will show up here. Rankings reset each stream week.",
  },
  rewards: {
    title: "Rewards",
    body: "Sub perks, giveaways, and channel rewards will be listed here. Follow on Kick so you do not miss drops.",
  },
};

export function FeatureTabs() {
  const [openTab, setOpenTab] = useState<TabId | null>("balance");

  function toggleTab(id: TabId) {
    setOpenTab((current) => (current === id ? null : id));
  }

  return (
    <nav className={styles.wrap} aria-label="Community features">
      <p className={styles.heading}>Community</p>
      <ul className={styles.list}>
        {TABS.map((tab) => {
          const isOpen = openTab === tab.id;
          const panel = tab.id === "balance" ? null : PANEL_COPY[tab.id];

          return (
            <li key={tab.id} className={styles.item}>
              <button
                type="button"
                id={`tab-${tab.id}`}
                className={styles.trigger}
                aria-expanded={isOpen}
                aria-controls={`panel-${tab.id}`}
                onClick={() => toggleTab(tab.id)}
              >
                <span>{tab.label}</span>
                <span className={styles.chevron} aria-hidden data-open={isOpen || undefined} />
              </button>
              <div
                id={`panel-${tab.id}`}
                className={`${styles.panel} ${tab.id === "balance" ? styles.panelWide : ""}`}
                data-open={isOpen || undefined}
                role="region"
                aria-labelledby={`tab-${tab.id}`}
                aria-hidden={!isOpen}
              >
                {tab.id === "balance" ? (
                  <GuessBalancePanel />
                ) : panel ? (
                  <>
                    <p className={styles.panelTitle}>{panel.title}</p>
                    <p className={styles.panelBody}>{panel.body}</p>
                  </>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
