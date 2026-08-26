import {
  getGiveawayState,
  setGiveawayEntriesOpen,
  setGiveawayKeyword,
} from "@/lib/giveaway";
import { authorizeStreamerAdmin } from "@/lib/site-auth";

export async function POST(request: Request) {
  if (!(await authorizeStreamerAdmin(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { open?: boolean; keyword?: string };
  try {
    body = (await request.json()) as { open?: boolean; keyword?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.keyword === "string") {
    const keyword = body.keyword.trim();
    if (!keyword) {
      return Response.json({ error: "keyword cannot be empty" }, { status: 400 });
    }
    if (keyword.length > 64) {
      return Response.json(
        { error: "keyword must be 64 characters or fewer" },
        { status: 400 },
      );
    }
    setGiveawayKeyword(keyword);
  }

  if (typeof body.open === "boolean") {
    const state = getGiveawayState();
    if (body.open && !state.keyword.trim()) {
      return Response.json(
        { error: "Set a keyword before opening entries" },
        { status: 400 },
      );
    }
    setGiveawayEntriesOpen(body.open);
  }

  if (typeof body.keyword !== "string" && typeof body.open !== "boolean") {
    return Response.json(
      { error: "Provide keyword and/or open" },
      { status: 400 },
    );
  }

  return Response.json(getGiveawayState());
}

export async function GET() {
  const state = getGiveawayState();
  return Response.json({
    entriesOpen: state.entriesOpen,
    keyword: state.keyword,
  });
}
