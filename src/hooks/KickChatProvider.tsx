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
  /** Refresh chatroom id and force a WebSocket reconnect. */
  reconnectChat: () => Promise<void>;
  /** Request that the shared socket stay connected for this consumer. */
  setChatNeeded: (key: string, needed: boolean) => void;
};

const KickChatContext = createContext<KickChatContextValue | null>(null);

const CHATROOM_STORAGE_KEY = "blakjac21.kick.chatroomId";

function readStoredChatroomId(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CHATROOM_STORAGE_KEY);
    if (!raw) return null;
    const id = Number(raw);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

function storeChatroomId(id: number) {
  try {
    sessionStorage.setItem(CHATROOM_STORAGE_KEY, String(id));
  } catch {
    // Ignore storage failures — chat can still run for this session.
  }
}

export function KickChatProvider({ children }: { children: ReactNode }) {
  const [chatroomId, setChatroomId] = useState<number | null>(() =>
    readStoredChatroomId(),
  );
  const [connectionState, setConnectionState] =
    useState<KickChatConnectionState>("idle");
  const [reconnectToken, setReconnectToken] = useState(0);
  const [neededKeys, setNeededKeys] = useState<string[]>([]);
  const subscribersRef = useRef(new Set<MessageHandler>());

  const chatNeeded = neededKeys.length > 0;

  const refreshChatroom = useCallback(async () => {
    try {
      const res = await fetch("/api/kick/chatroom", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { chatroomId?: number };
      if (data.chatroomId) {
        setChatroomId(data.chatroomId);
        storeChatroomId(data.chatroomId);
      }
    } catch {
      // Keep the last known chatroom id so chat can still reconnect offline.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadChatroom() {
      if (cancelled) return;
      await refreshChatroom();
    }

    loadChatroom();
    const timer = setInterval(loadChatroom, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [refreshChatroom]);

  const broadcast = useCallback((message: KickChatMessage) => {
    for (const handler of subscribersRef.current) {
      handler(message);
    }
  }, []);

  useKickChat({
    chatroomId,
    enabled: Boolean(chatroomId) && chatNeeded,
    reconnectToken,
    onMessage: broadcast,
    onConnectionChange: setConnectionState,
  });

  const subscribe = useCallback((handler: MessageHandler) => {
    subscribersRef.current.add(handler);
    return () => {
      subscribersRef.current.delete(handler);
    };
  }, []);

  const reconnectChat = useCallback(async () => {
    await refreshChatroom();
    setReconnectToken((token) => token + 1);
  }, [refreshChatroom]);

  const setChatNeeded = useCallback((key: string, needed: boolean) => {
    setNeededKeys((current) => {
      const has = current.includes(key);
      if (needed && !has) return [...current, key];
      if (!needed && has) return current.filter((item) => item !== key);
      return current;
    });
  }, []);

  const value = useMemo(
    () => ({
      chatroomId,
      connectionState,
      subscribe,
      reconnectChat,
      setChatNeeded,
    }),
    [chatroomId, connectionState, subscribe, reconnectChat, setChatNeeded],
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

/**
 * Keep the shared Kick chat socket connected while `needed` is true.
 * When `needed` flips to true, refresh the chatroom and force a reconnect.
 */
export function useKickChatDemand(key: string, needed: boolean) {
  const { setChatNeeded, reconnectChat } = useKickChatContext();
  const wasNeededRef = useRef(false);

  useEffect(() => {
    setChatNeeded(key, needed);
    return () => setChatNeeded(key, false);
  }, [key, needed, setChatNeeded]);

  useEffect(() => {
    if (needed && !wasNeededRef.current) {
      void reconnectChat();
    }
    wasNeededRef.current = needed;
  }, [needed, reconnectChat]);
}
