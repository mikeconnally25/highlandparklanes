import { clearGiveawayEntries, verifyGiveawayAdminToken } from "@/lib/giveaway";

export async function POST(request: Request) {
  if (!verifyGiveawayAdminToken(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json(clearGiveawayEntries());
}
