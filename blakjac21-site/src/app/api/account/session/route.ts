import { destroySession, getKickOAuthConfig, getSessionUser } from "@/lib/site-auth";

export async function GET() {
  const user = await getSessionUser();
  const kick = getKickOAuthConfig();
  return Response.json(
    {
      user,
      kickConfigured: kick.configured,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE() {
  await destroySession();
  return Response.json({ ok: true });
}
