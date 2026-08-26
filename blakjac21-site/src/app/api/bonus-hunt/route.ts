import {
  flushBonusHuntPersist,
  getBonusHuntState,
  hydrateBonusHuntFromRemote,
} from "@/lib/bonus-hunt";
import { ensureStakeSlotCatalog } from "@/lib/stake-slots";

export async function GET() {
  ensureStakeSlotCatalog();
  const state = await hydrateBonusHuntFromRemote();
  await flushBonusHuntPersist();
  return Response.json(state ?? getBonusHuntState(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
