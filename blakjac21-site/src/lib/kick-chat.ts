import { KICK_CHANNEL_SLUG, fetchChannelStatus } from "@/lib/kick";

type KickChannelChatResponse = {
  id?: number;
  chatroom?: {
    id?: number;
  };
};

export async function fetchChatroomMeta() {
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
  const chatroomId = data.chatroom?.id;
  const channelId = data.id;

  if (!chatroomId) {
    throw new Error("Chatroom id not found");
  }

  const status = await fetchChannelStatus();

  return {
    slug: KICK_CHANNEL_SLUG,
    chatroomId,
    channelId: channelId ?? null,
    isLive: status.isLive,
  };
}
