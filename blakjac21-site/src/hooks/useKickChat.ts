"use client";

import { useEffect, useRef } from "react";
import { parseBalanceGuess } from "@/lib/guess-balance";

const LEGACY_PUSHER_URL =
  "wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0-rc2&flash=false";

export type KickChatMessage = {
  username: string;
  content: string;
};

export type KickChatConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "error";

type UseKickChatOptions = {
  chatroomId: number | null;
  enabled: boolean;
  onMessage: (message: KickChatMessage) => void;
  onConnectionChange?: (state: KickChatConnectionState) => void;
};

function parsePusherPayload(raw: string): KickChatMessage | null {
  try {
    const outer = JSON.parse(raw) as { event?: string; data?: string };
    if (outer.event !== "App\\Events\\ChatMessageEvent" || !outer.data) {
      return null;
    }

    const data = JSON.parse(outer.data) as {
      content?: string;
      message?: string;
      sender?: { username?: string; slug?: string; name?: string };
      user?: { username?: string; slug?: string; name?: string };
    };

    const content = (data.content ?? data.message ?? "").trim();
    const username = (
      data.sender?.username ??
      data.sender?.slug ??
      data.sender?.name ??
      data.user?.username ??
      data.user?.slug ??
      data.user?.name ??
      ""
    ).trim();

    if (!content || !username) return null;
    return { username, content };
  } catch {
    return null;
  }
}

async function resolveWebSocketUrl(): Promise<string> {
  return LEGACY_PUSHER_URL;
}

async function resolveFallbackWebSocketUrl(): Promise<string | null> {
  try {
    const res = await fetch("/api/kick/ws-token", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { url?: string };
    return data.url ?? null;
  } catch {
    return null;
  }
}

export function useKickChat({
  chatroomId,
  enabled,
  onMessage,
  onConnectionChange,
}: UseKickChatOptions) {
  const onMessageRef = useRef(onMessage);
  const onConnectionChangeRef = useRef(onConnectionChange);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onConnectionChangeRef.current = onConnectionChange;
  }, [onConnectionChange]);

  useEffect(() => {
    if (!enabled || !chatroomId) {
      onConnectionChangeRef.current?.("idle");
      return;
    }

    let closed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let openTimer: ReturnType<typeof setTimeout> | undefined;
    let connected = false;
    let useFallback = false;

    function setConnection(state: KickChatConnectionState) {
      onConnectionChangeRef.current?.(state);
    }

    function subscribe() {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      socket.send(
        JSON.stringify({
          event: "pusher:subscribe",
          data: {
            auth: "",
            channel: `chatrooms.${chatroomId}.v2`,
          },
        }),
      );
    }

    function handleFrame(raw: string) {
      let frame: { event?: string; data?: string };
      try {
        frame = JSON.parse(raw) as { event?: string; data?: string };
      } catch {
        return;
      }

      if (frame.event === "pusher:connection_established") {
        connected = true;
        if (openTimer) clearTimeout(openTimer);
        setConnection("connected");
        subscribe();
        return;
      }

      if (frame.event === "pusher_internal:subscription_succeeded") {
        connected = true;
        setConnection("connected");
        return;
      }

      if (frame.event === "pusher:ping") {
        socket?.send(JSON.stringify({ event: "pusher:pong", data: {} }));
        return;
      }

      if (frame.event === "pusher:error") {
        setConnection("error");
        return;
      }

      const chat = parsePusherPayload(raw);
      if (chat) onMessageRef.current(chat);
    }

    async function connect(attemptFallback = false) {
      if (closed) return;
      setConnection("connecting");
      connected = false;
      if (openTimer) clearTimeout(openTimer);

      try {
        const url = attemptFallback
          ? await resolveFallbackWebSocketUrl()
          : await resolveWebSocketUrl();
        if (!url || closed) {
          if (!attemptFallback) {
            reconnectTimer = setTimeout(() => {
              void connect(true);
            }, 1500);
            return;
          }
          setConnection("error");
          reconnectTimer = setTimeout(() => {
            void connect(false);
          }, 3000);
          return;
        }

        useFallback = attemptFallback;
        socket = new WebSocket(url);

        socket.addEventListener("open", () => {
          subscribe();
          openTimer = setTimeout(() => {
            if (!connected && socket?.readyState === WebSocket.OPEN) {
              connected = true;
              setConnection("connected");
              subscribe();
            }
          }, 1500);
        });

        socket.addEventListener("message", (event) => {
          handleFrame(String(event.data));
        });

        socket.addEventListener("error", () => {
          setConnection("error");
        });

        socket.addEventListener("close", () => {
          connected = false;
          if (openTimer) clearTimeout(openTimer);
          if (!closed) {
            setConnection("connecting");
            reconnectTimer = setTimeout(() => {
              void connect(useFallback);
            }, 3000);
          }
        });
      } catch {
        setConnection("error");
        if (!closed) {
          reconnectTimer = setTimeout(() => {
            void connect(!attemptFallback && useFallback);
          }, 3000);
        }
      }
    }

    void connect(false);

    return () => {
      closed = true;
      setConnection("idle");
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (openTimer) clearTimeout(openTimer);
      socket?.close();
    };
  }, [chatroomId, enabled]);
}

export function isBalanceGuessMessage(content: string): boolean {
  return parseBalanceGuess(content) != null;
}
