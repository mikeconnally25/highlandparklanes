"use client";

import { useState } from "react";
import Link from "next/link";
import { KICK_CHANNEL_URL } from "@/lib/kick";
import styles from "./FeatureTabs.module.css";

type PanelTabId = "social";

type SocialLink = {
  label: string;
  href: string;
  handle?: string;
};

type TabConfig =
  | {
      id: string;
      label: string;
      description: string;
      kind: "link";
      href: string;
      accent: "cyan" | "gold" | "live";
    }
  | {
      id: string;
      label: string;
      description: string;
      kind: "external";
      href: string;
      accent: "cyan" | "gold" | "live";
    }
  | {
      id: PanelTabId;
      label: string;
      description: string;
      kind: "panel";
      accent: "cyan" | "gold" | "live";
    };

const STAKE_URL = "https://stake.com/?offer=blakjac21&c=c52feb0e28";

const TABS: TabConfig[] = [
  {
    id: "guessBalance",
    label: "Guess the Balance",
    description: "Call the balance live and climb the board.",
    kind: "link",
    href: "/guess-the-balance",
    accent: "gold",
  },
  {
    id: "bonusHunts",
    label: "Bonus Hunts",
    description: "Track slots, wins, and break-even in real time.",
    kind: "link",
    href: "/bonus-hunts",
    accent: "cyan",
  },
  {
    id: "giveaways",
    label: "Giveaways",
    description: "Enter with a chat keyword and spin the winner wheel.",
    kind: "link",
    href: "/giveaways",
    accent: "live",
  },
  {
    id: "leaderboard",
    label: "Leaderboard",
    description: "See who is wagering the most this month.",
    kind: "link",
    href: "/leaderboard",
    accent: "cyan",
  },
  {
    id: "rewards",
    label: "Rewards",
    description: "Streamer perks, codes, and community drops.",
    kind: "link",
    href: "/rewards",
    accent: "gold",
  },
  {
    id: "stake",
    label: "Stake",
    description: "Play with code blakjac21 and support the stream.",
    kind: "external",
    href: STAKE_URL,
    accent: "gold",
  },
  {
    id: "social",
    label: "Social Media",
    description: "Kick, X, and Discord — follow for stream updates.",
    kind: "panel",
    accent: "cyan",
  },
];

const PANEL_COPY: Record<
  PanelTabId,
  { title: string; body: string; links?: SocialLink[] }
> = {
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
        href: "https://x.com/21Blakjac",
        handle: "@21Blakjac",
      },
      {
        label: "Discord",
        href: "https://discord.gg/2VWu6RA7MF",
        handle: "discord.gg/2VWu6RA7MF",
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
    <section
      id="features"
      className={styles.wrap}
      aria-label="Site feature menu"
    >
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Menu</p>
        <p className={styles.lead}>
          Pick a card to jump into hunts, giveaways, guesses, and more.
        </p>
      </div>

      <nav aria-label="Site features">
        <ul className={styles.grid}>
          {TABS.map((tab) => {
            if (tab.kind === "link") {
              return (
                <li key={tab.id}>
                  <Link
                    className={styles.card}
                    href={tab.href}
                    data-accent={tab.accent}
                  >
                    <span className={styles.cardLabel}>{tab.label}</span>
                    <span className={styles.cardDesc}>{tab.description}</span>
                    <span className={styles.cardAction}>Open</span>
                  </Link>
                </li>
              );
            }

            if (tab.kind === "external") {
              return (
                <li key={tab.id}>
                  <a
                    className={styles.card}
                    href={tab.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-accent={tab.accent}
                  >
                    <span className={styles.cardLabel}>{tab.label}</span>
                    <span className={styles.cardDesc}>{tab.description}</span>
                    <span className={styles.cardAction}>Visit</span>
                  </a>
                </li>
              );
            }

            const panelId = tab.id;
            const isOpen = openTab === panelId;

            return (
              <li key={panelId}>
                <button
                  type="button"
                  id={`tab-${panelId}`}
                  className={styles.card}
                  data-accent={tab.accent}
                  data-selected={isOpen || undefined}
                  aria-expanded={isOpen}
                  aria-controls={`panel-${panelId}`}
                  onClick={() => toggleTab(panelId)}
                >
                  <span className={styles.cardLabel}>{tab.label}</span>
                  <span className={styles.cardDesc}>{tab.description}</span>
                  <span className={styles.cardAction}>
                    {isOpen ? "Close" : "Select"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {openTab ? (
        <div
          id={`panel-${openTab}`}
          className={styles.panel}
          role="region"
          aria-labelledby={`tab-${openTab}`}
        >
          <p className={styles.panelTitle}>{PANEL_COPY[openTab].title}</p>
          <p className={styles.panelBody}>{PANEL_COPY[openTab].body}</p>
          {PANEL_COPY[openTab].links?.length ? (
            <ul className={styles.socialList}>
              {PANEL_COPY[openTab].links.map((link) => (
                <li key={link.label}>
                  <a
                    className={styles.socialLink}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className={styles.socialLabel}>{link.label}</span>
                    {link.handle ? (
                      <span className={styles.socialHandle}>{link.handle}</span>
                    ) : null}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
