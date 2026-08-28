"use client";

import { useEffect, useState } from "react";
import {
  buildHuntListOverlayUrl,
  buildOverlayUrl,
  HUNT_LIVE_EVENT,
} from "@/lib/hunt-client-sync";
import styles from "./ObsOverlayLink.module.css";

type OverlayKind = "stats" | "list";

export function ObsOverlayLink() {
  const [copied, setCopied] = useState<OverlayKind | null>(null);
  const [statsPreview, setStatsPreview] = useState("/bonus-hunts/overlay");
  const [listPreview, setListPreview] = useState("/bonus-hunts/overlay/list");

  function statsUrl() {
    if (typeof window === "undefined") return "/bonus-hunts/overlay";
    return buildOverlayUrl(window.location.origin, null);
  }

  function listUrl() {
    if (typeof window === "undefined") return "/bonus-hunts/overlay/list";
    return buildHuntListOverlayUrl(window.location.origin, null);
  }

  useEffect(() => {
    setStatsPreview(statsUrl().replace(window.location.origin, "") || statsUrl());
    setListPreview(listUrl().replace(window.location.origin, "") || listUrl());

    function refreshPaths() {
      setStatsPreview(
        statsUrl().replace(window.location.origin, "") || statsUrl(),
      );
      setListPreview(
        listUrl().replace(window.location.origin, "") || listUrl(),
      );
    }

    window.addEventListener(HUNT_LIVE_EVENT, refreshPaths);
    return () => window.removeEventListener(HUNT_LIVE_EVENT, refreshPaths);
  }, []);

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
          win, and compact bonus table. Set once in OBS — the overlay clears
          when you press End hunt and updates live for the next hunt.
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
          list columns (Hunt #, break even, slot, bet, win). Same URL works
          across hunts — no need to re-copy after End hunt.
        </p>
      </div>
    </div>
  );
}
