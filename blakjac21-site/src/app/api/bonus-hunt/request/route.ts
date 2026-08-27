import {
  addSlotRequest,
  hydrateBonusHuntFromRemote,
  parseSlotRequestMessage,
} from "@/lib/bonus-hunt";
import { huntJson } from "@/lib/hunt-api";
import { resolveAllowedStakeSlot } from "@/lib/stake-slots";

export async function POST(request: Request) {
  // Pull shared board first so serverless instances see requestsOpen.
  await hydrateBonusHuntFromRemote();

  let body: { username?: string; message?: string; slotName?: string };
  try {
    body = (await request.json()) as {
      username?: string;
      message?: string;
      slotName?: string;
    };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const username = body.username?.trim();
  const message = body.message?.trim() ?? "";

  if (!username) {
    return Response.json({ error: "username is required" }, { status: 400 });
  }

  const parsed = message
    ? parseSlotRequestMessage(message)
    : body.slotName?.trim()
      ? { slotName: body.slotName.trim() }
      : null;

  if (!parsed) {
    return Response.json(
      { error: "Type !s followed by a slot name" },
      { status: 400 },
    );
  }

  const allowed = await resolveAllowedStakeSlot(parsed.slotName);
  if (!allowed.ok) {
    return huntJson(
      { error: allowed.reason, allowed: false },
      { status: 400 },
    );
  }

  const result = addSlotRequest(username, allowed.slot.name);
  if (!result.accepted) {
    return huntJson(
      { error: result.reason ?? "Request rejected", state: result.state },
      { status: 409 },
    );
  }

  return huntJson(result.state);
}
