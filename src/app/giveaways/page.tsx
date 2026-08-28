import type { Metadata } from "next";
import Link from "next/link";
import { AccountHeader } from "@/components/AccountHeader";
import { BrandLogo } from "@/components/BrandLogo";
import { GiveawayPanel } from "@/components/GiveawayPanel";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Giveaways | Blakjac21",
  description:
    "Community giveaways from Blakjac21 — enter in Kick chat with the live keyword.",
};

export default function GiveawaysPage() {
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
        <p className={styles.eyebrow}>Community</p>
        <h1 className={styles.title}>Giveaways</h1>
        <p className={styles.lead}>
          Free drops for the Blakjac21 community. When entries are open, type
          the keyword in Kick chat to enter.
        </p>

        <section className={styles.section} aria-label="Live giveaway">
          <GiveawayPanel />
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerBrandRow}>
          <BrandLogo href={null} size="sm" />
          <p className={styles.footerBrand}>Blakjac21</p>
        </div>
        <p className={styles.disclaimer}>
          For entertainment only. Gambling involves risk. Please play
          responsibly — 18+ / 21+ where required. Giveaways are free to enter
          and not tied to wagering.
        </p>
      </footer>
    </div>
  );
}
