import { getPastHunt, getPastHunts } from "@/lib/bonus-hunt";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (id) {
    const hunt = getPastHunt(id);
    if (!hunt) {
      return Response.json({ error: "Hunt not found" }, { status: 404 });
    }
    return Response.json(hunt, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  return Response.json(
    { hunts: getPastHunts() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
