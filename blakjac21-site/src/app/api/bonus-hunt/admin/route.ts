import {
  clearPastHunts,
  clearSlotRequests,
  endAndArchiveHunt,
  hydrateBonusHuntFromRemote,
  promoteSlotRequestToBonus,
  removePastHunt,
  removeSlotRequest,
  setBonusWinAmount,
  setHuntActive,
  setHuntTitle,
  setStartAmount,
} from "@/lib/bonus-hunt";
import type { BonusTier } from "@/lib/bonus-hunt";
import { huntJson } from "@/lib/hunt-api";
import { authorizeStreamerAdmin } from "@/lib/site-auth";

export async function POST(request: Request) {
  if (!(await authorizeStreamerAdmin(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Always hydrate before mutating so cold serverless instances don't wipe Redis.
  await hydrateBonusHuntFromRemote();

  let body: {
    action?:
      | "clear-requests"
      | "remove-request"
      | "promote-request"
      | "set-active"
      | "end-hunt"
      | "set-title"
      | "set-start-amount"
      | "set-win-amount"
      | "delete-past-hunt"
      | "clear-past-hunts";
    id?: string;
    active?: boolean;
    title?: string;
    startAmount?: string | number | null;
    winAmount?: string | number | null;
    betSize?: string | number | null;
    tier?: BonusTier;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  switch (body.action) {
    case "clear-requests":
      return huntJson(clearSlotRequests());
    case "remove-request":
      if (!body.id) {
        return Response.json({ error: "id is required" }, { status: 400 });
      }
      return huntJson(removeSlotRequest(body.id));
    case "promote-request": {
      if (!body.id) {
        return Response.json({ error: "id is required" }, { status: 400 });
      }
      const result = promoteSlotRequestToBonus({
        requestId: body.id,
        betSize: body.betSize,
        winAmount: body.winAmount,
        tier: body.tier,
      });
      if (!result.accepted) {
        return huntJson(
          {
            error: result.reason ?? "Could not add bonus from request",
            state: result.state,
          },
          { status: 400 },
        );
      }
      return huntJson(result.state);
    }
    case "set-active":
      if (typeof body.active !== "boolean") {
        return Response.json(
          { error: "active must be a boolean" },
          { status: 400 },
        );
      }
      return huntJson(setHuntActive(body.active));
    case "end-hunt": {
      const result = endAndArchiveHunt();
      return huntJson({
        ...result.state,
        archived: result.archived,
      });
    }
    case "set-title":
      return huntJson(setHuntTitle(body.title ?? ""));
    case "set-start-amount": {
      const result = setStartAmount(body.startAmount);
      if (!result.accepted) {
        return huntJson(
          {
            error: result.reason ?? "Could not set start amount",
            state: result.state,
          },
          { status: 400 },
        );
      }
      return huntJson(result.state);
    }
    case "set-win-amount": {
      if (!body.id) {
        return Response.json({ error: "id is required" }, { status: 400 });
      }
      const result = setBonusWinAmount({
        id: body.id,
        winAmount: body.winAmount,
      });
      if (!result.accepted) {
        return huntJson(
          {
            error: result.reason ?? "Could not set win amount",
            state: result.state,
          },
          { status: 400 },
        );
      }
      return huntJson(result.state);
    }
    case "delete-past-hunt": {
      if (!body.id) {
        return Response.json({ error: "id is required" }, { status: 400 });
      }
      const result = removePastHunt(body.id);
      if (!result.removed) {
        return huntJson(
          { error: "Hunt not found", hunts: result.hunts },
          { status: 404 },
        );
      }
      return huntJson({ hunts: result.hunts });
    }
    case "clear-past-hunts":
      return huntJson({ hunts: clearPastHunts() });
    default:
      return Response.json({ error: "Unknown action" }, { status: 400 });
  }
}
