import {
  getBonusHuntState,
  hydrateBonusHuntFromRemote,
  setRequestsOpen,
} from "@/lib/bonus-hunt";
import { huntJson } from "@/lib/hunt-api";
import { authorizeStreamerAdmin } from "@/lib/site-auth";

export async function POST(request: Request) {
  if (!(await authorizeStreamerAdmin(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await hydrateBonusHuntFromRemote();

  let body: { open?: boolean };
  try {
    body = (await request.json()) as { open?: boolean };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.open !== "boolean") {
    return Response.json({ error: "open must be a boolean" }, { status: 400 });
  }

  return huntJson(setRequestsOpen(body.open));
}

export async function GET() {
  const state = await hydrateBonusHuntFromRemote();
  return Response.json({ requestsOpen: state.requestsOpen });
}
