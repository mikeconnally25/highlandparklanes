"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import type { KickStatus, KickVod } from "@/lib/kick";
import { KICK_CHANNEL_URL, KICK_PLAYER_URL } from "@/lib/kick";
import styles from "./KickPlayer.module.css";

const POLL_MS = 45_000;

type PlayerMode = "loading" | "live" | "vod" | "vod-link" | "fallback";

export function KickPlayer() {
  const [status, setStatus] = useState<KickStatus | null>(null);
  const [mode, setMode] = useState<PlayerMode>("loading");
  const [vodSource, setVodSource] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function load() {
      try {
        const res = await fetch("/api/kick/status", { cache: "no-store" });
        const data = (await res.json()) as KickStatus;
        if (cancelled) return;
        setStatus(data);

        if (data.isLive) {
          setMode("live");
          setVodSource(null);
        } else if (data.latestVod) {
          await resolveVod(data.latestVod);
        } else {
          setMode("fallback");
          setVodSource(null);
        }
      } catch {
        if (!cancelled) {
          setMode("fallback");
          setStatus((prev) =>
            prev ?? {
              slug: "Blakjac21",
              isLive: false,
              title: null,
              viewerCount: null,
              latestVod: null,
              error: "Could not reach Kick status",
            },
          );
        }
      } finally {
        if (!cancelled) {
          timer = setTimeout(load, POLL_MS);
        }
      }
    }

    async function resolveVod(vod: KickVod) {
      try {
        const res = await fetch(`/api/kick/vod/${vod.uuid}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as { source: string | null };
        if (cancelled) return;
        const canPlayHls =
          Boolean(data.source) &&
          (Hls.isSupported() ||
            document
              .createElement("video")
              .canPlayType("application/vnd.apple.mpegurl") !== "");
        if (data.source && canPlayHls) {
          setVodSource(data.source);
          setMode("vod");
        } else {
          setVodSource(null);
          setMode("vod-link");
        }
      } catch {
        if (!cancelled) {
          setVodSource(null);
          setMode("vod-link");
        }
      }
    }

    load();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || mode !== "vod" || !vodSource) return;

    let hls: Hls | null = null;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = vodSource;
    } else if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true });
      hls.loadSource(vodSource);
      hls.attachMedia(video);
    }

    return () => {
      if (hls) hls.destroy();
    };
  }, [mode, vodSource]);

  const isLive = mode === "live";
  const label =
    mode === "live"
      ? "LIVE"
      : mode === "vod" || mode === "vod-link"
        ? "LATEST VOD"
        : mode === "loading"
          ? "CONNECTING"
          : "WATCH ON KICK";

  const title =
    status?.title ??
    status?.latestVod?.title ??
    (isLive ? "Live on Kick" : "Catch the latest stream on Kick");

  return (
    <section className={styles.wrap} aria-label="Blakjac21 stream player">
      <div className={styles.meta}>
        <span
          className={`${styles.badge} ${isLive ? styles.badgeLive : styles.badgeOffline}`}
        >
          <span className={styles.badgeDot} aria-hidden />
          {label}
        </span>
        <p className={styles.title}>{title}</p>
        {isLive && typeof status?.viewerCount === "number" ? (
          <p className={styles.viewers}>
            {status.viewerCount.toLocaleString()} watching
          </p>
        ) : null}
      </div>

      <div className={styles.stage}>
        {mode === "loading" ? (
          <div className={styles.placeholder}>
            <p>Connecting to Kick…</p>
          </div>
        ) : null}

        {mode === "live" ? (
          <iframe
            className={styles.frame}
            src={`${KICK_PLAYER_URL}?autoplay=true&muted=true`}
            title="Blakjac21 live on Kick"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            scrolling="no"
          />
        ) : null}

        {mode === "vod" ? (
          <video
            ref={videoRef}
            className={styles.video}
            controls
            playsInline
            poster={status?.latestVod?.thumbnail ?? undefined}
          />
        ) : null}

        {mode === "vod-link" && status?.latestVod ? (
          <a
            className={styles.vodCard}
            href={status.latestVod.watchUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {status.latestVod.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={status.latestVod.thumbnail}
                alt=""
                className={styles.vodThumb}
              />
            ) : (
              <div className={styles.vodFallbackBg} />
            )}
            <span className={styles.vodOverlay}>
              <span className={styles.playIcon} aria-hidden>
                <span className={styles.playTriangle} />
              </span>
              <span className={styles.vodCta}>Watch latest VOD on Kick</span>
            </span>
          </a>
        ) : null}

        {mode === "fallback" ? (
          <a
            className={styles.vodCard}
            href={KICK_CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className={styles.vodFallbackBg} />
            <span className={styles.vodOverlay}>
              <span className={styles.playIcon} aria-hidden>
                <span className={styles.playTriangle} />
              </span>
              <span className={styles.vodCta}>Open Blakjac21 on Kick</span>
            </span>
          </a>
        ) : null}
      </div>
    </section>
  );
}
