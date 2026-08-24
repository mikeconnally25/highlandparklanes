import { KickPlayer } from "@/components/KickPlayer";
import { WatchCta } from "@/components/WatchCta";
import { KICK_CHANNEL_URL } from "@/lib/kick";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div className={styles.logoSlot} aria-label="Logo placeholder">
          <span className={styles.logoMark}>BJ</span>
          <span className={styles.logoHint}>Logo soon</span>
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

      <main className={styles.hero}>
        <div className={styles.brandBlock}>
          <p className={styles.eyebrow}>Gambling streams on Kick</p>
          <h1 className={styles.brand}>Blakjac21</h1>
          <p className={styles.tagline}>
            High-stakes sessions, live when it counts — watch on Kick.
          </p>
          <div className={styles.ctas}>
            <WatchCta />
            <a
              className={styles.ctaSecondary}
              href={KICK_CHANNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open on Kick
            </a>
          </div>
        </div>

        <div id="watch" className={styles.playerBleed}>
          <KickPlayer />
        </div>
      </main>

      <footer className={styles.footer}>
        <p className={styles.footerBrand}>Blakjac21</p>
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
  );
}
