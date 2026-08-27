"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  useKickChat,
  type KickChatConnectionState,
  type KickChatMessage,
} from "@/hooks/useKickChat";

type MessageHandler = (message: KickChatMessage) => void;

type KickChatContextValue = {
  chatroomId: number | null;
  connectionState: KickChatConnectionState;
  subscribe: (handler: MessageHandler) => () => void;
};

const KickChatContext = createContext<KickChatContextValue | null>(null);

export function KickChatProvider({ children }: { children: ReactNode }) {
  const [chatroomId, setChatroomId] = useState<number | null>(null);
  const [connectionState, setConnectionState] =
    useState<KickChatConnectionState>("idle");
  const subscribersRef = useRef(new Set<MessageHandler>());

  useEffect(() => {
    let cancelled = false;

    async function loadChatroom() {
      try {
        const res = await fetch("/api/kick/chatroom", { cache: "no-store" });
        const data = (await res.json()) as { chatroomId?: number };
        if (!cancelled && data.chatroomId) {
          setChatroomId(data.chatroomId);
        }
      } catch {
        if (!cancelled) setChatroomId(null);
      }
    }

    loadChatroom();
    const timer = setInterval(loadChatroom, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const broadcast = useCallback((message: KickChatMessage) => {
    for (const handler of subscribersRef.current) {
      handler(message);
    }
  }, []);

  useKickChat({
    chatroomId,
    enabled: Boolean(chatroomId),
    onMessage: broadcast,
    onConnectionChange: setConnectionState,
  });

  const subscribe = useCallback((handler: MessageHandler) => {
    subscribersRef.current.add(handler);
    return () => {
      subscribersRef.current.delete(handler);
    };
  }, []);

  const value = useMemo(
    () => ({
      chatroomId,
      connectionState,
      subscribe,
    }),
    [chatroomId, connectionState, subscribe],
  );

  return (
    <KickChatContext.Provider value={value}>{children}</KickChatContext.Provider>
  );
}

export function useKickChatContext(): KickChatContextValue {
  const ctx = useContext(KickChatContext);
  if (!ctx) {
    throw new Error("useKickChatContext requires KickChatProvider");
  }
  return ctx;
}

/** Register a chat message handler on the site-wide Kick connection. */
export function useKickChatSubscription(
  handler: MessageHandler,
  enabled = true,
) {
  const { subscribe } = useKickChatContext();
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) return;
    return subscribe((message) => handlerRef.current(message));
  }, [enabled, subscribe]);
}
