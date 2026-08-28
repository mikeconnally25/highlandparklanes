import { getGuessBalanceState } from "@/lib/guess-balance";

export async function GET() {
  const state = getGuessBalanceState();
  return Response.json(state, {
    headers: { "Cache-Control": "no-store" },
  });
}
