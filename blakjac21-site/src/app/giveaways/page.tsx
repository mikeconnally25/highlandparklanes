import type { Metadata } from "next";
import Link from "next/link";
import { AccountHeader } from "@/components/AccountHeader";
import { BrandLogo } from "@/components/BrandLogo";
import { KICK_CHANNEL_URL } from "@/lib/kick";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Giveaways | Blakjac21",
  description:
    "Community giveaways from Blakjac21 — how to enter on Kick and Discord.",
};

const DISCORD_URL = "https://discord.gg/2VWu6RA7MF";

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
          Free drops for the Blakjac21 community. Watch live and hop in Discord
          when a giveaway opens.
        </p>

        <section className={styles.section} aria-labelledby="active-giveaway">
          <h2 id="active-giveaway" className={styles.sectionTitle}>
            Active giveaway
          </h2>
          <div className={styles.card}>
            <p className={styles.cardStatus}>Coming soon</p>
            <p className={styles.cardTitle}>No giveaway running right now</p>
            <p className={styles.cardBody}>
              When one starts, details and entry steps will show up here. Follow
              the stream and Discord so you do not miss the next drop.
            </p>
            <div className={styles.actions}>
              <a
                className={styles.cardLink}
                href={KICK_CHANNEL_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Watch on Kick
              </a>
              <a
                className={styles.secondaryLink}
                href={DISCORD_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Join Discord
              </a>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="how-to-enter">
          <h2 id="how-to-enter" className={styles.sectionTitle}>
            How to enter
          </h2>
          <ol className={styles.steps}>
            <li>Be in the Kick chat during the giveaway window.</li>
            <li>Follow any entry command or link announced on stream.</li>
            <li>Check Discord for bonus entries or winner posts.</li>
          </ol>
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
