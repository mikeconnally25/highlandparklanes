import {
  clearSlotRequests,
  promoteSlotRequestToBonus,
  removeSlotRequest,
  setBonusWinAmount,
  setHuntActive,
  setHuntTitle,
  setStartAmount,
  verifyBonusHuntAdminToken,
} from "@/lib/bonus-hunt";
import type { BonusTier } from "@/lib/bonus-hunt";

export async function POST(request: Request) {
  if (!verifyBonusHuntAdminToken(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    action?:
      | "clear-requests"
      | "remove-request"
      | "promote-request"
      | "set-active"
      | "set-title"
      | "set-start-amount"
      | "set-win-amount";
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
      return Response.json(clearSlotRequests());
    case "remove-request":
      if (!body.id) {
        return Response.json({ error: "id is required" }, { status: 400 });
      }
      return Response.json(removeSlotRequest(body.id));
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
        return Response.json(
          {
            error: result.reason ?? "Could not add bonus from request",
            state: result.state,
          },
          { status: 400 },
        );
      }
      return Response.json(result.state);
    }
    case "set-active":
      if (typeof body.active !== "boolean") {
        return Response.json(
          { error: "active must be a boolean" },
          { status: 400 },
        );
      }
      return Response.json(setHuntActive(body.active));
    case "set-title":
      return Response.json(setHuntTitle(body.title ?? ""));
    case "set-start-amount": {
      const result = setStartAmount(body.startAmount);
      if (!result.accepted) {
        return Response.json(
          {
            error: result.reason ?? "Could not set start amount",
            state: result.state,
          },
          { status: 400 },
        );
      }
      return Response.json(result.state);
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
        return Response.json(
          {
            error: result.reason ?? "Could not set win amount",
            state: result.state,
          },
          { status: 400 },
        );
      }
      return Response.json(result.state);
    }
    default:
      return Response.json({ error: "Unknown action" }, { status: 400 });
  }
}
