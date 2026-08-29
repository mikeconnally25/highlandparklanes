import type { BonusHuntState } from "@/lib/bonus-hunt";

export const OVERLAY_POLL_MS = 1500;
export const OVERLAY_FAST_POLL_MS = 400;
export const OVERLAY_FAST_POLL_WINDOW_MS = 45_000;

export function huntOverlayFingerprint(state: BonusHuntState): string {
  return [
    String(state.boardEpoch ?? 0),
    state.updatedAt,
    state.huntActive ? "1" : "0",
    state.requestsOpen ? "1" : "0",
    state.title,
    String(state.startAmount ?? ""),
    state.bonuses
      .map(
        (bonus) =>
          `${bonus.id}:${bonus.name}:${bonus.betSize ?? ""}:${bonus.winAmount ?? ""}:${bonus.tier}:${bonus.requestedBy ?? ""}:${bonus.thumbnailUrl ?? ""}`,
      )
      .join("|"),
    state.slotRequests
      .map((req) => `${req.id}:${req.slotName}:${req.username}`)
      .join("|"),
  ].join("::");
}

export function overlayPollIntervalMs(
  mode: "obs" | "preview",
  fastPollUntilMs: number,
): number {
  if (Date.now() < fastPollUntilMs) return OVERLAY_FAST_POLL_MS;
  return mode === "preview" ? 4000 : OVERLAY_POLL_MS;
}
