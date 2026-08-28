import {
  getGuessBalanceState,
  setEntriesOpen,
} from "@/lib/guess-balance";
import { authorizeStreamerAdmin } from "@/lib/site-auth";

export async function POST(request: Request) {
  if (!(await authorizeStreamerAdmin(request))) {
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

  const state = setEntriesOpen(body.open);
  return Response.json(state);
}

export async function GET() {
  const state = getGuessBalanceState();
  return Response.json({ entriesOpen: state.entriesOpen });
}
