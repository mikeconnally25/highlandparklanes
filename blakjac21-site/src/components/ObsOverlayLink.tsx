"use client";

import { useState } from "react";
import {
  buildHuntListOverlayUrl,
  buildOverlayUrl,
  readHuntCache,
} from "@/lib/hunt-client-sync";
import styles from "./ObsOverlayLink.module.css";

type OverlayKind = "stats" | "list";

export function ObsOverlayLink() {
  const [copied, setCopied] = useState<OverlayKind | null>(null);
  const [statsPreview, setStatsPreview] = useState("/bonus-hunts/overlay");
  const [listPreview, setListPreview] = useState("/bonus-hunts/overlay/list");

  function statsUrl() {
    if (typeof window === "undefined") return "/bonus-hunts/overlay";
    return buildOverlayUrl(window.location.origin, readHuntCache());
  }

  function listUrl() {
    if (typeof window === "undefined") return "/bonus-hunts/overlay/list";
    return buildHuntListOverlayUrl(window.location.origin, readHuntCache());
  }

  async function copyUrl(kind: OverlayKind) {
    const url = kind === "stats" ? statsUrl() : listUrl();
    const relative = url.replace(window.location.origin, "") || url;
    if (kind === "stats") setStatsPreview(relative);
    else setListPreview(relative);

    try {
      await navigator.clipboard.writeText(url);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.block}>
        <p className={styles.label}>OBS · Stats overlay</p>
        <code className={styles.url}>{statsPreview}</code>
        <button
          type="button"
          className={styles.copyBtn}
          onClick={() => copyUrl("stats")}
        >
          {copied === "stats" ? "Copied" : "Copy full URL"}
        </button>
        <p className={styles.hint}>
          Width ~440 · Height ~720 · Transparent background. Stats, best/lucky
          win, and compact bonus table.
        </p>
      </div>

      <div className={styles.block}>
        <p className={styles.label}>OBS · Hunt list overlay</p>
        <code className={styles.url}>{listPreview}</code>
        <button
          type="button"
          className={styles.copyBtn}
          onClick={() => copyUrl("list")}
        >
          {copied === "list" ? "Copied" : "Copy full URL"}
        </button>
        <p className={styles.hint}>
          Width ~780 · Height ~520 · Transparent background. Matches the hunt
          list columns (Hunt #, break even, slot, bet, win). Copy again after
          adding bonuses so OBS gets the latest list.
        </p>
      </div>
    </div>
  );
}
