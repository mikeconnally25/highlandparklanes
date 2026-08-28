import { clearGuesses } from "@/lib/guess-balance";
import { authorizeStreamerAdmin } from "@/lib/site-auth";

export async function POST(request: Request) {
  if (!(await authorizeStreamerAdmin(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = clearGuesses();
  return Response.json(state);
}
