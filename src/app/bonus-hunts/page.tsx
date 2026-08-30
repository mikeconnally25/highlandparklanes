import type { Metadata } from "next";
import Link from "next/link";
import { AccountHeader } from "@/components/AccountHeader";
import { BonusHuntsBoard } from "@/components/BonusHuntsBoard";
import { BrandLogo } from "@/components/BrandLogo";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Bonus Hunts | Blakjac21",
  description: "Live bonus hunt board for Blakjac21 on Kick.",
};

export default function BonusHuntsPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <BrandLogo size="sm" />
          <Link className={styles.homeLink} href="/">
            ← Home
          </Link>
        </div>
        <AccountHeader />
      </header>

      <main className={styles.main}>
        <div className={styles.intro}>
          <p className={styles.kicker}>Live board</p>
          <h1 className={styles.heading}>Bonus Hunts</h1>
          <p className={styles.lead}>
            Run the hunt from here — slot requests, bonus list, break-even, and
            OBS overlays stay in sync.
          </p>
        </div>

        <BonusHuntsBoard />
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <BrandLogo href={null} size="sm" />
          <span>Blakjac21</span>
        </div>
        <p className={styles.disclaimer}>
          For entertainment only. Gambling involves risk. Please play
          responsibly — 18+ / 21+ where required.
        </p>
      </footer>
    </div>
  );
}
