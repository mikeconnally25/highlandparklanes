import Link from "next/link";
import { AccountHeader } from "@/components/AccountHeader";
import { BrandLogo } from "@/components/BrandLogo";
import { FeatureTabs } from "@/components/FeatureTabs";
import { HomeCommunity } from "@/components/HomeCommunity";
import { HomeHuntStats } from "@/components/HomeHuntStats";
import { HomeLiveStrip } from "@/components/HomeLiveStrip";
import { KickPlayer } from "@/components/KickPlayer";
import { WatchCta } from "@/components/WatchCta";
import { KICK_CHANNEL_URL } from "@/lib/kick";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.top}>
          <BrandLogo size="md" showWordmark priority />
          <AccountHeader />
        </header>

        <main>
          <section className={styles.hero} aria-label="Blakjac21">
            <div className={styles.heroGrid}>
              <div className={styles.brandBlock}>
                <p className={styles.eyebrow}>Gambling streams on Kick</p>
                <h1 className={styles.brand}>Blakjac21</h1>
                <p className={styles.tagline}>
                  High-stakes sessions, live when it counts — watch on Kick.
                </p>
                <div className={styles.ctas}>
                  <WatchCta />
                  <Link className={styles.secondaryCta} href="#features">
                    Explore features
                  </Link>
                </div>
              </div>

              <div id="watch" className={styles.playerBleed}>
                <KickPlayer />
              </div>
            </div>
          </section>

          <HomeLiveStrip />

          <div className={styles.menuStage}>
            <FeatureTabs />
          </div>

          <HomeHuntStats />
          <HomeCommunity />
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
          <a
            className={styles.footerLink}
            href={KICK_CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Follow on Kick
          </a>
        </footer>
      </div>
    </div>
  );
}
