import { addGiveawayEntry } from "@/lib/giveaway";

export async function POST(request: Request) {
  let body: { username?: string; message?: string };
  try {
    body = (await request.json()) as { username?: string; message?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const username = body.username?.trim();
  const message = body.message?.trim() ?? "";

  if (!username) {
    return Response.json({ error: "username is required" }, { status: 400 });
  }
  if (!message) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  const result = addGiveawayEntry({ username, rawMessage: message });

  if (!result.accepted) {
    return Response.json(
      { error: result.reason ?? "Entry rejected", state: result.state },
      { status: 409 },
    );
  }

  return Response.json(result.state);
}
