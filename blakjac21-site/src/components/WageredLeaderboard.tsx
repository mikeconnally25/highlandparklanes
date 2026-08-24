"use client";

import { useWageredLeaderboard } from "@/hooks/useWageredLeaderboard";
import styles from "./WageredLeaderboard.module.css";

function formatUpdatedAt(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function WageredLeaderboard() {
  const { data, error, loading } = useWageredLeaderboard();

  if (loading && !data) {
    return (
      <div className={styles.wrap}>
        <p className={styles.status}>Loading leaderboard…</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={styles.wrap}>
        <p className={styles.error} role="alert">
          {error}
        </p>
      </div>
    );
  }

  if (!data || data.entries.length === 0) {
    return (
      <div className={styles.wrap}>
        <p className={styles.status}>
          No wagered leaderboard data for the current month yet.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {data.periodLabel ? (
        <p className={styles.period}>
          Current month: {data.periodLabel}
          {data.periodStart && data.periodEnd
            ? ` (${data.periodStart} – ${data.periodEnd})`
            : ""}
        </p>
      ) : null}

      <ol className={styles.list} aria-label="Top 10 wagered leaderboard">
        {data.entries.map((entry) => (
          <li
            key={`${entry.rank}-${entry.userName}`}
            className={styles.item}
            data-rank={entry.rank <= 3 ? entry.rank : undefined}
          >
            <span className={styles.rank}>{entry.rank}</span>
            <span className={styles.userName}>{entry.userName}</span>
            <span className={styles.wagered}>{entry.wagered}</span>
          </li>
        ))}
      </ol>

      <p className={styles.meta}>
        Top 10 wagered this month · auto-refreshes every minute
        {data.updatedAt ? ` · Updated ${formatUpdatedAt(data.updatedAt)}` : ""}
      </p>

      {error ? (
        <p className={styles.errorInline} role="status">
          Latest refresh failed — showing last loaded data.
        </p>
      ) : null}
    </div>
  );
}
