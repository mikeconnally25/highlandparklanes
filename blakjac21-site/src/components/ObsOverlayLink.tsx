"use client";

import { useState } from "react";
import {
  buildOverlayUrl,
  readHuntCache,
} from "@/lib/hunt-client-sync";
import styles from "./ObsOverlayLink.module.css";

export function ObsOverlayLink() {
  const [copied, setCopied] = useState(false);
  const [urlPreview, setUrlPreview] = useState("/bonus-hunts/overlay");

  function currentUrl() {
    if (typeof window === "undefined") return "/bonus-hunts/overlay";
    return buildOverlayUrl(window.location.origin, readHuntCache());
  }

  async function copyUrl() {
    const url = currentUrl();
    setUrlPreview(url.replace(window.location.origin, "") || url);

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
      <code className={styles.url}>{urlPreview}</code>
      <button type="button" className={styles.copyBtn} onClick={copyUrl}>
        {copied ? "Copied" : "Copy full URL"}
      </button>
      <p className={styles.hint}>
        Width ~440 · Height ~720 · Transparent background recommended. Copy
        again after adding bonuses so OBS gets the latest list.
      </p>
    </div>
  );
}
