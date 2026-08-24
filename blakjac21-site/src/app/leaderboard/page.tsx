import type { Metadata } from "next";
import Link from "next/link";
import { KICK_CHANNEL_URL } from "@/lib/kick";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Leaderboard | Blakjac21",
  description:
    "Top viewers, streak holders, and community rankings from Blakjac21 streams on Kick.",
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
          Top viewers and streak holders from Blakjac21 streams. Rankings reset
          each stream week — show up live to climb the board.
        </p>

        <section className={styles.section} aria-labelledby="weekly-board">
          <h2 id="weekly-board" className={styles.sectionTitle}>
            This week
          </h2>
          <div className={styles.card}>
            <p className={styles.cardStatus}>Rankings coming soon</p>
            <p className={styles.cardBody}>
              Weekly top chatters, guess-the-balance wins, and watch-time leaders
              will appear here once tracking is wired up.
            </p>
            <a
              className={styles.cardLink}
              href={KICK_CHANNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Watch on Kick
            </a>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="all-time">
          <h2 id="all-time" className={styles.sectionTitle}>
            All-time
          </h2>
          <ul className={styles.list}>
            <li className={styles.card}>
              <p className={styles.cardLabel}>Hall of fame</p>
              <p className={styles.cardTitle}>
                Longest streaks and repeat winners will show up here
              </p>
              <p className={styles.cardBody}>
                Past week winners and community milestones — tied to stream
                events and chat activity.
              </p>
            </li>
          </ul>
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
