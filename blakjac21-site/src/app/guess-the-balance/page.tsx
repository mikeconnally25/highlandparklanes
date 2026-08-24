import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { GuessBalancePanel } from "@/components/GuessBalancePanel";
import { KICK_CHANNEL_URL } from "@/lib/kick";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Guess the Balance | Blakjac21",
  description:
    "Submit and view balance guesses from Blakjac21 Kick chat during live streams.",
};

export default function GuessTheBalancePage() {
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
        <h1 className={styles.title}>Guess the Balance</h1>
        <p className={styles.lead}>
          Call the balance in Kick chat when entries are open. Guesses appear
          here live — closest guess wins when the reveal hits.
        </p>

        <section className={styles.panelSection} aria-label="Guess the balance game">
          <GuessBalancePanel fullPage />
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
