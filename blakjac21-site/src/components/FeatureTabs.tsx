"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./FeatureTabs.module.css";

type PanelTabId = "rewards";

type TabConfig =
  | { id: string; label: string; kind: "link"; href: string }
  | { id: PanelTabId; label: string; kind: "panel" };

const TABS: TabConfig[] = [
  {
    id: "guessBalance",
    label: "Guess the Balance",
    kind: "link",
    href: "/guess-the-balance",
  },
  { id: "bonusHunts", label: "Bonus Hunts", kind: "link", href: "/bonus-hunts" },
  { id: "leaderboard", label: "Leaderboard", kind: "link", href: "/leaderboard" },
  { id: "rewards", label: "Rewards", kind: "panel" },
];

const PANEL_COPY: Record<PanelTabId, { title: string; body: string }> = {
  rewards: {
    title: "Rewards",
    body: "Sub perks, giveaways, and channel rewards will be listed here. Follow on Kick so you do not miss drops.",
  },
};

export function FeatureTabs() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openTab, setOpenTab] = useState<PanelTabId | null>(null);
  const rootRef = useRef<HTMLElement>(null);

  function toggleTab(id: PanelTabId) {
    setOpenTab((current) => (current === id ? null : id));
  }

  useEffect(() => {
    if (!menuOpen) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <nav className={styles.wrap} aria-label="Community features" ref={rootRef}>
      <button
        type="button"
        className={styles.menuTrigger}
        aria-expanded={menuOpen}
        aria-controls="community-dropdown"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span>Community</span>
        <span className={styles.menuChevron} data-open={menuOpen || undefined} aria-hidden />
      </button>

      <div
        id="community-dropdown"
        className={styles.dropdown}
        data-open={menuOpen || undefined}
        aria-hidden={!menuOpen}
      >
        <ul className={styles.list}>
          {TABS.map((tab) => {
            if (tab.kind === "link") {
              return (
                <li key={tab.id} className={styles.item}>
                  <Link
                    className={styles.linkTrigger}
                    href={tab.href}
                    onClick={() => setMenuOpen(false)}
                  >
                    <span>{tab.label}</span>
                    <span className={styles.linkArrow} aria-hidden />
                  </Link>
                </li>
              );
            }

            const isOpen = openTab === tab.id;
            const panel = PANEL_COPY[tab.id];

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
                  <span
                    className={styles.chevron}
                    aria-hidden
                    data-open={isOpen || undefined}
                  />
                </button>
                <div
                  id={`panel-${tab.id}`}
                  className={styles.panel}
                  data-open={isOpen || undefined}
                  role="region"
                  aria-labelledby={`tab-${tab.id}`}
                  aria-hidden={!isOpen}
                >
                  <p className={styles.panelTitle}>{panel.title}</p>
                  <p className={styles.panelBody}>{panel.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
