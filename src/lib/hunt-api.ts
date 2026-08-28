import { flushBonusHuntPersist } from "@/lib/bonus-hunt";

/** Return JSON after remote hunt persistence has flushed. */
export async function huntJson(data: unknown, init?: ResponseInit) {
  await flushBonusHuntPersist();
  return Response.json(data, init);
}
