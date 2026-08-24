import {
  getBonusHuntState,
  setRequestsOpen,
  verifyBonusHuntAdminToken,
} from "@/lib/bonus-hunt";

export async function POST(request: Request) {
  if (!verifyBonusHuntAdminToken(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { open?: boolean };
  try {
    body = (await request.json()) as { open?: boolean };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.open !== "boolean") {
    return Response.json({ error: "open must be a boolean" }, { status: 400 });
  }

  return Response.json(setRequestsOpen(body.open));
}

export async function GET() {
  const state = getBonusHuntState();
  return Response.json({ requestsOpen: state.requestsOpen });
}
