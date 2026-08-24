import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { KICK_CHANNEL_URL } from "@/lib/kick";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Rewards | Blakjac21",
  description:
    "Sub perks, giveaways, and channel rewards from Blakjac21 streams on Kick.",
};

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
        <a
          className={styles.kickLink}
          href={KICK_CHANNEL_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          kick.com/Blakjac21
        </a>
      </header>

      <main className={styles.main}>
        <p className={styles.eyebrow}>Community</p>
        <h1 className={styles.title}>Rewards</h1>
        <p className={styles.lead}>
          Sub perks, giveaways, and channel rewards — follow on Kick so you
          don’t miss drops.
        </p>

        <section className={styles.section} aria-labelledby="rewards-overview">
          <h2 id="rewards-overview" className={styles.sectionTitle}>
            Channel rewards
          </h2>
          <div className={styles.card}>
            <p className={styles.cardBody}>
              Reward details will be listed here as they go live — sub perks,
              giveaways, and other channel drops from stream.
            </p>
            <a
              className={styles.cardLink}
              href={KICK_CHANNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Follow on Kick
            </a>
          </div>
        </section>
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
