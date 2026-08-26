import { KICK_CHANNEL_URL } from "@/lib/kick";
import styles from "./HomeCommunity.module.css";

const STAKE_URL = "https://stake.com/?offer=blakjac21&c=c52feb0e28";

const SOCIAL = [
  {
    label: "Kick",
    handle: "kick.com/Blakjac21",
    href: KICK_CHANNEL_URL,
  },
  {
    label: "X / Twitter",
    handle: "@21Blakjac",
    href: "https://x.com/21Blakjac",
  },
  {
    label: "Discord",
    handle: "discord.gg/2VWu6RA7MF",
    href: "https://discord.gg/2VWu6RA7MF",
  },
];

export function HomeCommunity() {
  return (
    <section className={styles.section} aria-labelledby="home-community">
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Community</p>
        <h2 id="home-community" className={styles.title}>
          Stay connected
        </h2>
        <p className={styles.lead}>
          Stream alerts, highlights, and chat — follow wherever you hang out.
        </p>
      </div>

      <ul className={styles.socialList}>
        {SOCIAL.map((link) => (
          <li key={link.label}>
            <a
              className={styles.socialLink}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className={styles.socialLabel}>{link.label}</span>
              <span className={styles.socialHandle}>{link.handle}</span>
            </a>
          </li>
        ))}
      </ul>

      <div className={styles.stakeRow}>
        <p className={styles.stakeCopy}>
          Playing on Stake? Use code{" "}
          <span className={styles.stakeCode}>blakjac21</span> for support.
        </p>
        <a
          className={styles.stakeLink}
          href={STAKE_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open Stake →
        </a>
      </div>
    </section>
  );
}
