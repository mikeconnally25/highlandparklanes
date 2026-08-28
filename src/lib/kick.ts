export const KICK_CHANNEL_SLUG = "Blakjac21";
export const KICK_CHANNEL_URL = `https://kick.com/${KICK_CHANNEL_SLUG}`;
export const KICK_PLAYER_URL = `https://player.kick.com/${KICK_CHANNEL_SLUG}`;

export type KickVod = {
  uuid: string;
  title: string;
  thumbnail: string | null;
  createdAt: string | null;
  durationMs: number | null;
  views: number | null;
  watchUrl: string;
};

export type KickStatus = {
  slug: string;
  isLive: boolean;
  title: string | null;
  viewerCount: number | null;
  latestVod: KickVod | null;
  error: string | null;
};

type KickChannelResponse = {
  livestream?: {
    session_title?: string;
    viewer_count?: number;
  } | null;
  recent_categories?: Array<{
    name?: string;
  }>;
};

type KickVideoItem = {
  session_title?: string;
  views?: number;
  duration?: number;
  created_at?: string;
  thumbnail?: {
    src?: string;
    url?: string;
  };
  video?: {
    uuid?: string;
    is_private?: boolean;
  } | null;
};

type KickVideoDetail = {
  source?: string;
  playback_url?: string;
  video_url?: string;
  livestream?: {
    session_title?: string;
    thumbnail?: string;
  };
};

const KICK_HEADERS: HeadersInit = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (compatible; Blakjac21Site/1.0; +https://kick.com/Blakjac21)",
};

async function kickFetch(url: string): Promise<Response> {
  return fetch(url, {
    headers: KICK_HEADERS,
    next: { revalidate: 45 },
  });
}

export async function fetchChannelStatus(
  slug: string = KICK_CHANNEL_SLUG,
): Promise<KickStatus> {
  const base: KickStatus = {
    slug,
    isLive: false,
    title: null,
    viewerCount: null,
    latestVod: null,
    error: null,
  };

  try {
    const channelRes = await kickFetch(
      `https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`,
    );

    if (!channelRes.ok) {
      base.error = `Channel lookup failed (${channelRes.status})`;
    } else {
      const channel = (await channelRes.json()) as KickChannelResponse;
      const live = channel.livestream ?? null;
      if (live) {
        base.isLive = true;
        base.title = live.session_title ?? null;
        base.viewerCount =
          typeof live.viewer_count === "number" ? live.viewer_count : null;
      }
    }

    if (!base.isLive) {
      base.latestVod = await fetchLatestVod(slug);
    }

    return base;
  } catch (err) {
    return {
      ...base,
      error: err instanceof Error ? err.message : "Failed to reach Kick",
    };
  }
}

export async function fetchLatestVod(
  slug: string = KICK_CHANNEL_SLUG,
): Promise<KickVod | null> {
  try {
    const res = await kickFetch(
      `https://kick.com/api/v2/channels/${encodeURIComponent(slug)}/videos`,
    );
    if (!res.ok) return null;

    const videos = (await res.json()) as KickVideoItem[];
    if (!Array.isArray(videos) || videos.length === 0) return null;

    const publicVod = videos.find(
      (item) => item.video?.uuid && item.video.is_private !== true,
    );
    if (!publicVod?.video?.uuid) return null;

    const uuid = publicVod.video.uuid;
    const thumbnail =
      publicVod.thumbnail?.src ?? publicVod.thumbnail?.url ?? null;

    return {
      uuid,
      title: publicVod.session_title ?? "Latest VOD",
      thumbnail,
      createdAt: publicVod.created_at ?? null,
      durationMs: typeof publicVod.duration === "number" ? publicVod.duration : null,
      views: typeof publicVod.views === "number" ? publicVod.views : null,
      watchUrl: `https://kick.com/${slug}/videos/${uuid}`,
    };
  } catch {
    return null;
  }
}

export async function fetchVodPlaybackSource(
  uuid: string,
): Promise<{ source: string | null; title: string | null }> {
  try {
    const res = await kickFetch(
      `https://kick.com/api/v1/video/${encodeURIComponent(uuid)}`,
    );
    if (!res.ok) return { source: null, title: null };

    const detail = (await res.json()) as KickVideoDetail;
    const source =
      detail.source ?? detail.playback_url ?? detail.video_url ?? null;

    return {
      source,
      title: detail.livestream?.session_title ?? null,
    };
  } catch {
    return { source: null, title: null };
  }
}
