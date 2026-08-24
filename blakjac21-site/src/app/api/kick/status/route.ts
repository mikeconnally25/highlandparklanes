import { fetchChannelStatus } from "@/lib/kick";

export async function GET() {
  const status = await fetchChannelStatus();

  return Response.json(status, {
    headers: {
      "Cache-Control": "public, s-maxage=45, stale-while-revalidate=30",
    },
  });
}
