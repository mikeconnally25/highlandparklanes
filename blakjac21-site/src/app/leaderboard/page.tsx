import type { Metadata } from "next";
import Link from "next/link";
import { WageredLeaderboard } from "@/components/WageredLeaderboard";
import { KICK_CHANNEL_URL } from "@/lib/kick";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Leaderboard | Blakjac21",
  description:
    "Top wagered players and community rankings from Blakjac21 streams on Kick.",
};

export default function LeaderboardPage() {
  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Link className={styles.backLink} href="/">
          ← Back home
        </Link>
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
        <h1 className={styles.title}>Leaderboard</h1>
        <p className={styles.lead}>
          Top wagered players under the Blakjac21 code. Rankings pull live from
          the affiliate sheet and refresh automatically as it updates.
        </p>

        <section className={styles.section} aria-labelledby="wagered-board">
          <h2 id="wagered-board" className={styles.sectionTitle}>
            Top wagered
          </h2>
          <div className={styles.card}>
            <WageredLeaderboard />
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <p className={styles.footerBrand}>Blakjac21</p>
        <p className={styles.disclaimer}>
          For entertainment only. Gambling involves risk. Please play
          responsibly — 18+ / 21+ where required.
        </p>
      </footer>
    </div>
  );
}
