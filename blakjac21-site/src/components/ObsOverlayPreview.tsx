"use client";

import { BonusOverlayWidget } from "@/components/BonusOverlayWidget";
import { HuntListOverlayWidget } from "@/components/HuntListOverlayWidget";
import styles from "./ObsOverlayPreview.module.css";

export function ObsOverlayPreview() {
  return (
    <div className={styles.wrap}>
      <div className={styles.previewBlock}>
        <p className={styles.label}>Live preview · Stats overlay</p>
        <div className={styles.frame} aria-label="Stats overlay preview">
          <div className={styles.scaledStats}>
            <BonusOverlayWidget mode="preview" limit={16} />
          </div>
        </div>
      </div>

      <div className={styles.previewBlock}>
        <p className={styles.label}>Live preview · Hunt list overlay</p>
        <div className={styles.frame} aria-label="Hunt list overlay preview">
          <div className={styles.scaledList}>
            <HuntListOverlayWidget mode="preview" limit={16} />
          </div>
        </div>
      </div>
    </div>
  );
}
