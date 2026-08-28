import {
  clearBonuses,
  hydrateBonusHuntFromRemote,
  removeBonus,
  seedBonusHuntFromClient,
  type BonusHuntState,
} from "@/lib/bonus-hunt";
import { huntJson } from "@/lib/hunt-api";
import { authorizeStreamerAdmin } from "@/lib/site-auth";

export async function POST(request: Request) {
  if (!(await authorizeStreamerAdmin(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await hydrateBonusHuntFromRemote();

  let body: { id?: string; all?: boolean; board?: BonusHuntState };
  try {
    body = (await request.json()) as {
      id?: string;
      all?: boolean;
      board?: BonusHuntState;
    };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.all) {
    return huntJson(clearBonuses());
  }

  if (!body.id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  seedBonusHuntFromClient(body.board);
  return huntJson(removeBonus(body.id));
}
