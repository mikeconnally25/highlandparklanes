"use client";

import { useBonusHuntBoard } from "@/hooks/useBonusHuntBoard";
import styles from "./ActiveHuntPanel.module.css";

export function ActiveHuntPanel() {
  useBonusHuntBoard();

  return (
    <div className={styles.wrap}>
      <p>rebuilding...</p>
    </div>
  );
}
