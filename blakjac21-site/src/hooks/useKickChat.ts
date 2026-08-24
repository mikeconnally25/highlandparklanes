"use client";

import { useEffect, useRef } from "react";
import { parseBalanceGuess } from "@/lib/guess-balance";

const PUSHER_URL =
  "wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0-rc2&flash=false";

type ChatMessage = {
  username: string;
  content: string;
};

type UseKickChatOptions = {
  chatroomId: number | null;
  enabled: boolean;
  onMessage: (message: ChatMessage) => void;
};

function parsePusherPayload(raw: string): ChatMessage | null {
  try {
    const outer = JSON.parse(raw) as { event?: string; data?: string };
    if (outer.event !== "App\\Events\\ChatMessageEvent" || !outer.data) {
      return null;
    }

    const data = JSON.parse(outer.data) as {
      content?: string;
      message?: string;
      sender?: { username?: string; slug?: string };
      user?: { username?: string; slug?: string };
    };

    const content = (data.content ?? data.message ?? "").trim();
    const username = (
      data.sender?.username ??
      data.sender?.slug ??
      data.user?.username ??
      data.user?.slug ??
      ""
    ).trim();

    if (!content || !username) return null;
    return { username, content };
  } catch {
    return null;
  }
}

export function useKickChat({
  chatroomId,
  enabled,
  onMessage,
}: UseKickChatOptions) {
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!enabled || !chatroomId) return;

    let closed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    function connect() {
      if (closed) return;
      socket = new WebSocket(PUSHER_URL);

      socket.addEventListener("open", () => {
        socket?.send(
          JSON.stringify({
            event: "pusher:subscribe",
            data: {
              auth: "",
              channel: `chatrooms.${chatroomId}.v2`,
            },
          }),
        );
      });

      socket.addEventListener("message", (event) => {
        const chat = parsePusherPayload(String(event.data));
        if (chat) onMessageRef.current(chat);
      });

      socket.addEventListener("close", () => {
        if (!closed) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      });
    }

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [chatroomId, enabled]);
}

export function isBalanceGuessMessage(content: string): boolean {
  return parseBalanceGuess(content) != null;
}
