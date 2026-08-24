"use client";

import { useState } from "react";
import styles from "./ObsOverlayLink.module.css";

const OVERLAY_PATH = "/bonus-hunts/overlay";

export function ObsOverlayLink() {
  const [copied, setCopied] = useState(false);

  async function copyUrl() {
    const url =
      typeof window === "undefined"
        ? OVERLAY_PATH
        : `${window.location.origin}${OVERLAY_PATH}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.label}>OBS Browser Source</p>
      <code className={styles.url}>{OVERLAY_PATH}</code>
      <button type="button" className={styles.copyBtn} onClick={copyUrl}>
        {copied ? "Copied" : "Copy full URL"}
      </button>
      <p className={styles.hint}>
        Width ~360 · Height ~720 · Transparent background recommended
      </p>
    </div>
  );
}
