import { getGiveawayState } from "@/lib/giveaway";

export async function GET() {
  return Response.json(getGiveawayState(), {
    headers: { "Cache-Control": "no-store" },
  });
}
