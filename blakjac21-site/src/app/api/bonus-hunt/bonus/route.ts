import {
  addBonus,
  hydrateBonusHuntFromRemote,
  seedBonusHuntFromClient,
  type BonusHuntState,
  type BonusTier,
} from "@/lib/bonus-hunt";
import { huntJson } from "@/lib/hunt-api";
import { authorizeStreamerAdmin } from "@/lib/site-auth";

export async function POST(request: Request) {
  if (!(await authorizeStreamerAdmin(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await hydrateBonusHuntFromRemote();

  let body: {
    name?: string;
    betSize?: string | number | null;
    winAmount?: string | number | null;
    tier?: BonusTier;
    requestId?: string | null;
    board?: BonusHuntState;
  };
  try {
    body = (await request.json()) as {
      name?: string;
      betSize?: string | number | null;
      winAmount?: string | number | null;
      tier?: BonusTier;
      requestId?: string | null;
      board?: BonusHuntState;
    };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Client board seeds this instance so adds accumulate across serverless splits.
  seedBonusHuntFromClient(body.board);

  const result = addBonus({
    name: body.name ?? "",
    betSize: body.betSize,
    winAmount: body.winAmount,
    tier: body.tier,
    requestId: body.requestId,
  });
  if (!result.accepted) {
    return huntJson(
      { error: result.reason ?? "Could not add bonus", state: result.state },
      { status: 400 },
    );
  }

  return huntJson(result.state);
}
