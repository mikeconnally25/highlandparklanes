import type { Metadata } from "next";
import Link from "next/link";
import { AccountHeader } from "@/components/AccountHeader";
import { BrandLogo } from "@/components/BrandLogo";
import { KICK_CHANNEL_URL } from "@/lib/kick";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "VIP Rewards | Blakjac21",
  description:
    "Exclusive Stake VIP rank-up bonuses from Blakjac21 — claim on Discord or Kick.",
};

const DISCORD_URL = "https://discord.gg/2VWu6RA7MF";

type RewardTier = {
  name: string;
  bonus: string;
  tone: "bronze" | "silver" | "gold" | "platinum" | "diamond" | "obsidian";
};

type RewardGroup = {
  id: string;
  title: string;
  tiers: RewardTier[];
};

const REWARD_GROUPS: RewardGroup[] = [
  {
    id: "core",
    title: "Core VIP",
    tiers: [
      { name: "Bronze", bonus: "$15", tone: "bronze" },
      { name: "Silver", bonus: "$50", tone: "silver" },
      { name: "Gold", bonus: "$75", tone: "gold" },
    ],
  },
  {
    id: "platinum",
    title: "Platinum",
    tiers: [
      { name: "Platinum 1", bonus: "$125", tone: "platinum" },
      { name: "Platinum 2", bonus: "$225", tone: "platinum" },
      { name: "Platinum 3", bonus: "$425", tone: "platinum" },
      { name: "Platinum 4", bonus: "$850", tone: "platinum" },
      { name: "Platinum 5", bonus: "$1,700", tone: "platinum" },
      { name: "Platinum 6", bonus: "$3,300", tone: "platinum" },
    ],
  },
  {
    id: "diamond",
    title: "Diamond",
    tiers: [
      { name: "Diamond 1", bonus: "Custom", tone: "diamond" },
      { name: "Diamond 2", bonus: "Custom", tone: "diamond" },
      { name: "Diamond 3", bonus: "Custom", tone: "diamond" },
      { name: "Diamond 4", bonus: "Custom", tone: "diamond" },
      { name: "Diamond 5", bonus: "Custom", tone: "diamond" },
    ],
  },
  {
    id: "elite",
    title: "Elite",
    tiers: [{ name: "Obsidian", bonus: "Custom", tone: "obsidian" }],
  },
];

export default function RewardsPage() {
  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div className={styles.topBrand}>
          <BrandLogo size="sm" />
          <Link className={styles.backLink} href="/">
            ← Back home
          </Link>
        </div>
        <AccountHeader />
      </header>

      <main className={styles.main}>
        <p className={styles.eyebrow}>Stake VIP</p>
        <h1 className={styles.title}>VIP Rewards</h1>
        <p className={styles.lead}>
          Exclusive bonuses for every Stake VIP level — claim each time you
          rank up.
        </p>

        <aside className={styles.note} aria-label="How to claim">
          <p className={styles.noteTitle}>How to claim</p>
          <p className={styles.noteBody}>
            DM Blakjac21 on Discord or Kick with proof of your VIP level when
            you rank up.
          </p>
          <div className={styles.noteActions}>
            <a
              className={styles.noteCta}
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Discord
            </a>
            <a
              className={styles.noteCtaSecondary}
              href={KICK_CHANNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Kick
            </a>
          </div>
        </aside>

        {REWARD_GROUPS.map((group) => (
          <section
            key={group.id}
            className={styles.section}
            aria-labelledby={`group-${group.id}`}
          >
            <h2 id={`group-${group.id}`} className={styles.sectionTitle}>
              {group.title}
            </h2>
            <ul className={styles.tierList}>
              {group.tiers.map((tier) => (
                <li
                  key={tier.name}
                  className={styles.tierRow}
                  data-tone={tier.tone}
                >
                  <span className={styles.tierName}>{tier.name}</span>
                  <span className={styles.tierBonus}>
                    {tier.bonus === "Custom" ? "Custom" : `${tier.bonus} bonus`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerBrandRow}>
          <BrandLogo href={null} size="sm" />
          <p className={styles.footerBrand}>Blakjac21</p>
        </div>
        <p className={styles.disclaimer}>
          For entertainment only. Gambling involves risk. Please play
          responsibly — 18+ / 21+ where required.
        </p>
      </footer>
    </div>
  );
}
