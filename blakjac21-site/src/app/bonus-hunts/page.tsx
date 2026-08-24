import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { KICK_CHANNEL_URL } from "@/lib/kick";
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
        <h1 className={styles.title}>Bonus Hunts</h1>
        <p className={styles.lead}>
          Follow along with bonus hunt streams, track opens, and compare results
          from past hunts on Kick.
        </p>

        <section className={styles.section} aria-labelledby="active-hunt">
          <h2 id="active-hunt" className={styles.sectionTitle}>
            Active hunt
          </h2>
          <div className={styles.card}>
            <p className={styles.cardStatus}>No active hunt right now</p>
            <p className={styles.cardBody}>
              When Blakjac21 goes live with a bonus hunt, stats and progress will
              show up here automatically.
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

        <section className={styles.section} aria-labelledby="past-hunts">
          <h2 id="past-hunts" className={styles.sectionTitle}>
            Past hunts
          </h2>
          <ul className={styles.list}>
            <li className={styles.card}>
              <p className={styles.cardLabel}>Latest VOD</p>
              <p className={styles.cardTitle}>
                Sunday sub day bonus hunt sessions will appear here
              </p>
              <p className={styles.cardBody}>
                Hunt history and P/L breakdown coming soon — tied to stream VODs
                and on-screen tracker data.
              </p>
            </li>
          </ul>
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
