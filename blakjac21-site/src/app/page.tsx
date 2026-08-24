import { BrandLogo } from "@/components/BrandLogo";
import { FeatureTabs } from "@/components/FeatureTabs";
import { KickPlayer } from "@/components/KickPlayer";
import { WatchCta } from "@/components/WatchCta";
import { KICK_CHANNEL_URL } from "@/lib/kick";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <aside className={styles.sideNav} aria-label="Primary">
        <FeatureTabs />
      </aside>

      <div className={styles.shell}>
        <header className={styles.top}>
          <BrandLogo size="md" showWordmark priority />
          <a
            className={styles.kickLink}
            href={KICK_CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            kick.com/Blakjac21
          </a>
        </header>

        <main className={styles.hero}>
          <div className={styles.heroGrid}>
            <div className={styles.brandBlock}>
              <p className={styles.eyebrow}>Gambling streams on Kick</p>
              <h1 className={styles.brand}>Blakjac21</h1>
              <p className={styles.tagline}>
                High-stakes sessions, live when it counts — watch on Kick.
              </p>
              <div className={styles.ctas}>
                <WatchCta />
              </div>
            </div>

            <div id="watch" className={styles.playerBleed}>
              <KickPlayer />
            </div>
          </div>
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
