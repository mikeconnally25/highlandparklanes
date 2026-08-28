import { clearGiveawayEntries } from "@/lib/giveaway";
import { authorizeStreamerAdmin } from "@/lib/site-auth";

export async function POST(request: Request) {
  if (!(await authorizeStreamerAdmin(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json(clearGiveawayEntries());
}
