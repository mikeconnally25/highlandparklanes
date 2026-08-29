import {
  flushBonusHuntPersist,
  getBonusHuntState,
  hydrateBonusHuntFromRemote,
  isIntentionalResetBoard,
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
  const incomingRequests = Array.isArray(body.slotRequests)
    ? body.slotRequests.length
    : 0;
  const currentRequests = current.slotRequests.length;
  const incomingReset = isIntentionalResetBoard(body);
  const incomingRicher =
    (incomingReset && incomingT >= currentT) ||
    Boolean(body.requestsOpen) !== current.requestsOpen ||
    incomingRequests > currentRequests ||
    body.bonuses.length > current.bonuses.length ||
    (body.bonuses.length === current.bonuses.length &&
      incomingRequests >= currentRequests &&
      incomingT >= currentT) ||
    (current.bonuses.length === 0 && body.bonuses.length > 0) ||
    (currentRequests === 0 && incomingRequests > 0);

  if (!incomingRicher && incomingT < currentT) {
    await flushBonusHuntPersist();
    return Response.json(current);
  }

  const next = replaceBonusHuntState(body);
  await flushBonusHuntPersist();
  return Response.json(next);
}
