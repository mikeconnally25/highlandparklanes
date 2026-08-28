"use client";

import { useKickStatus } from "@/hooks/useKickStatus";
import { KICK_CHANNEL_URL } from "@/lib/kick";
import styles from "./HomeLiveStrip.module.css";

function formatViewers(count: number | null): string | null {
  if (count == null) return null;
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}K watching`;
  return `${count.toLocaleString()} watching`;
}

export function HomeLiveStrip() {
  const status = useKickStatus();
  const isLive = status?.isLive ?? false;
  const viewers = formatViewers(status?.viewerCount ?? null);

  return (
    <section className={styles.strip} aria-label="Stream status">
      <div className={styles.inner}>
        <div className={styles.status}>
          {isLive ? (
            <>
              <span className={styles.liveDot} aria-hidden />
              <span className={styles.liveLabel}>Live on Kick</span>
            </>
          ) : (
            <span className={styles.offlineLabel}>Offline</span>
          )}
        </div>

        <p className={styles.detail}>
          {isLive && status?.title ? (
            status.title
          ) : status?.latestVod?.title ? (
            <>Latest: {status.latestVod.title}</>
          ) : (
            "Follow Blakjac21 for the next gambling stream."
          )}
        </p>

        {isLive && viewers ? (
          <p className={styles.viewers}>{viewers}</p>
        ) : null}

        <a
          className={styles.action}
          href={KICK_CHANNEL_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          {isLive ? "Join stream" : "Follow on Kick"}
        </a>
      </div>
    </section>
  );
}
