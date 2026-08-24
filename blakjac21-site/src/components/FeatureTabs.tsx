"use client";

import { useState } from "react";
import Link from "next/link";
import { KICK_CHANNEL_URL } from "@/lib/kick";
import styles from "./FeatureTabs.module.css";

type PanelTabId = "rewards" | "social";

type SocialLink = {
  label: string;
  href: string;
  handle?: string;
};

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
  { id: "social", label: "Social Media", kind: "panel" },
];

const PANEL_COPY: Record<
  PanelTabId,
  { title: string; body: string; links?: SocialLink[] }
> = {
  rewards: {
    title: "Rewards",
    body: "Sub perks, giveaways, and channel rewards will be listed here. Follow on Kick so you do not miss drops.",
  },
  social: {
    title: "Social Media",
    body: "Follow Blakjac21 across platforms for stream updates, highlights, and community posts.",
    links: [
      {
        label: "Kick",
        href: KICK_CHANNEL_URL,
        handle: "kick.com/Blakjac21",
      },
      {
        label: "X / Twitter",
        href: "https://x.com/Blakjac21",
        handle: "@Blakjac21",
      },
      {
        label: "Instagram",
        href: "https://instagram.com/Blakjac21",
        handle: "@Blakjac21",
      },
      {
        label: "Discord",
        href: "https://discord.gg/",
        handle: "Coming soon",
      },
    ],
  },
};

export function FeatureTabs() {
  const [openTab, setOpenTab] = useState<PanelTabId | null>(null);

  function toggleTab(id: PanelTabId) {
    setOpenTab((current) => (current === id ? null : id));
  }

  return (
    <nav className={styles.wrap} aria-label="Site features">
      <p className={styles.navLabel}>Menu</p>
      <ul className={styles.list}>
        {TABS.map((tab) => {
          if (tab.kind === "link") {
            return (
              <li key={tab.id} className={styles.item}>
                <Link className={styles.linkTrigger} href={tab.href}>
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
                {panel.links?.length ? (
                  <ul className={styles.socialList}>
                    {panel.links.map((link) => (
                      <li key={link.label}>
                        <a
                          className={styles.socialLink}
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <span className={styles.socialLabel}>{link.label}</span>
                          {link.handle ? (
                            <span className={styles.socialHandle}>
                              {link.handle}
                            </span>
                          ) : null}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
