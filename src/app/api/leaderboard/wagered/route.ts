import { fetchWageredLeaderboard } from "@/lib/wagered-leaderboard";

export async function GET() {
  try {
    const data = await fetchWageredLeaderboard(10);

    return Response.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load leaderboard";

    return Response.json({ error: message }, { status: 502 });
  }
}
