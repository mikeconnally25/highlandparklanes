"use client";

import { useKickStatus } from "@/hooks/useKickStatus";
import styles from "./WatchCta.module.css";

export function WatchCta() {
  const status = useKickStatus();
  const isLive = status?.isLive ?? false;

  return (
    <a className={styles.cta} href="#watch" data-live={isLive || undefined}>
      {isLive ? (
        <>
          <span className={styles.liveDot} aria-hidden />
          Live now
        </>
      ) : (
        "Watch now"
      )}
    </a>
  );
}
