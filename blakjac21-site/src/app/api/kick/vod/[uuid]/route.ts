import { fetchVodPlaybackSource } from "@/lib/kick";

type RouteContext = {
  params: Promise<{ uuid: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { uuid } = await context.params;

  if (!uuid || !/^[0-9a-f-]{36}$/i.test(uuid)) {
    return Response.json({ error: "Invalid VOD id" }, { status: 400 });
  }

  const playback = await fetchVodPlaybackSource(uuid);

  return Response.json(playback, {
    headers: {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60",
    },
  });
}
