import { getBonusHuntState } from "@/lib/bonus-hunt";
import { ensureStakeSlotCatalog } from "@/lib/stake-slots";

export async function GET() {
  ensureStakeSlotCatalog();
  return Response.json(getBonusHuntState(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
