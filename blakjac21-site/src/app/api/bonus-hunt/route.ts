import { getBonusHuntState } from "@/lib/bonus-hunt";

export async function GET() {
  return Response.json(getBonusHuntState(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
