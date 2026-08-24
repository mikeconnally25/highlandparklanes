import { clearGuesses, verifyGuessAdminToken } from "@/lib/guess-balance";

export async function POST(request: Request) {
  if (!verifyGuessAdminToken(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = clearGuesses();
  return Response.json(state);
}
