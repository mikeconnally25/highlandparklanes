import { removeGiveawayEntry, verifyGiveawayAdminToken } from "@/lib/giveaway";

export async function POST(request: Request) {
  if (!verifyGiveawayAdminToken(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { username?: string };
  try {
    body = (await request.json()) as { username?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const username = body.username?.trim();
  if (!username) {
    return Response.json({ error: "username is required" }, { status: 400 });
  }

  const result = removeGiveawayEntry(username);
  if (!result.removed) {
    return Response.json(
      { error: "Entrant not found", state: result.state },
      { status: 404 },
    );
  }

  return Response.json(result.state);
}
