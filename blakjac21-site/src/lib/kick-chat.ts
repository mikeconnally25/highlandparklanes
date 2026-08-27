import { KICK_CHANNEL_SLUG } from "@/lib/kick";

type KickChannelChatResponse = {
  id?: number;
  livestream?: unknown | null;
  chatroom?: {
    id?: number;
  };
};

function fallbackChatroomId(): number | null {
  const raw = process.env.KICK_CHATROOM_ID?.trim();
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function fetchChatroomMeta() {
  try {
    const res = await fetch(
      `https://kick.com/api/v2/channels/${encodeURIComponent(KICK_CHANNEL_SLUG)}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (compatible; Blakjac21Site/1.0; +https://kick.com/Blakjac21)",
        },
        next: { revalidate: 300 },
      },
    );

    if (!res.ok) {
      throw new Error(`Chatroom lookup failed (${res.status})`);
    }

    const data = (await res.json()) as KickChannelChatResponse;
    const chatroomId = data.chatroom?.id ?? fallbackChatroomId();

    if (!chatroomId) {
      throw new Error("Chatroom id not found");
    }

    return {
      slug: KICK_CHANNEL_SLUG,
      chatroomId,
      channelId: data.id ?? null,
      // Stream can be offline while chat stays active — never gate chat on isLive.
      isLive: Boolean(data.livestream),
    };
  } catch (err) {
    const chatroomId = fallbackChatroomId();
    if (chatroomId) {
      return {
        slug: KICK_CHANNEL_SLUG,
        chatroomId,
        channelId: null,
        isLive: false,
        degraded: true as const,
        error: err instanceof Error ? err.message : "Failed to load chatroom",
      };
    }
    throw err;
  }
}
