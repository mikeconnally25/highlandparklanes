import {
  flushBonusHuntPersist,
  getBonusHuntState,
  hydrateBonusHuntFromRemote,
  replaceBonusHuntState,
} from "@/lib/bonus-hunt";
import { authorizeStreamerAdmin } from "@/lib/site-auth";
import type { BonusHuntState } from "@/lib/bonus-hunt";

/**
 * Admin browser can push its known-good board when serverless GETs
 * return a stale empty instance. Requires streamer admin session.
 */
export async function POST(request: Request) {
  if (!(await authorizeStreamerAdmin(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: BonusHuntState;
  try {
    body = (await request.json()) as BonusHuntState;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || !Array.isArray(body.bonuses)) {
    return Response.json({ error: "Invalid hunt state" }, { status: 400 });
  }

  await hydrateBonusHuntFromRemote();
  const current = getBonusHuntState();
  const currentT = Date.parse(current.updatedAt) || 0;
  const incomingT = Date.parse(body.updatedAt) || 0;
  const incomingRicher =
    body.bonuses.length > current.bonuses.length ||
    (body.bonuses.length === current.bonuses.length && incomingT >= currentT) ||
    (current.bonuses.length === 0 && body.bonuses.length > 0);

  if (!incomingRicher && incomingT < currentT) {
    await flushBonusHuntPersist();
    return Response.json(current);
  }

  const next = replaceBonusHuntState(body);
  await flushBonusHuntPersist();
  return Response.json(next);
}
