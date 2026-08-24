import { destroySession, getSessionUser } from "@/lib/site-auth";

export async function GET() {
  const user = await getSessionUser();
  return Response.json(
    { user },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE() {
  await destroySession();
  return Response.json({ ok: true });
}
