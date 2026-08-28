"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { BonusHuntState } from "@/lib/bonus-hunt";
import { writeHuntCache } from "@/lib/hunt-client-sync";

type HuntBoardContextValue = {
  board: BonusHuntState | null;
  publishBoard: (state: BonusHuntState) => void;
};

const HuntBoardContext = createContext<HuntBoardContextValue | null>(null);

export function HuntBoardProvider({ children }: { children: ReactNode }) {
  const [board, setBoard] = useState<BonusHuntState | null>(null);

  const publishBoard = useCallback((state: BonusHuntState) => {
    setBoard(state);
    writeHuntCache(state);
  }, []);

  const value = useMemo(
    () => ({ board, publishBoard }),
    [board, publishBoard],
  );

  return (
    <HuntBoardContext.Provider value={value}>
      {children}
    </HuntBoardContext.Provider>
  );
}

export function useHuntBoard(): HuntBoardContextValue {
  const ctx = useContext(HuntBoardContext);
  if (!ctx) {
    return {
      board: null,
      publishBoard: (state: BonusHuntState) => {
        writeHuntCache(state);
      },
    };
  }
  return ctx;
}

export function useHuntBoardState(): BonusHuntState | null {
  return useHuntBoard().board;
}
