import type { Metadata } from "next";
import Link from "next/link";
import { AccountHeader } from "@/components/AccountHeader";
import { BonusHuntsBoard } from "@/components/BonusHuntsBoard";
import { BrandLogo } from "@/components/BrandLogo";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Bonus Hunts | Blakjac21",
  description: "Track active and past bonus hunts from Blakjac21 streams on Kick.",
};

export default function BonusHuntsPage() {
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
        <h1 className={styles.title}>Bonus Hunts</h1>
        <p className={styles.lead}>
          Use the Active hunt dropdown for the live board. End a hunt to archive
          it under Past hunt results.
        </p>

        <BonusHuntsBoard />
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
