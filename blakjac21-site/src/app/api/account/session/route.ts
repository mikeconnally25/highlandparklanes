import {
  destroySession,
  getAdminKickUsernames,
  getKickOAuthConfig,
  getSessionUser,
} from "@/lib/site-auth";
import { getKickCallbackUrl } from "@/lib/site-url";

export async function GET(request: Request) {
  const user = await getSessionUser();
  const kick = getKickOAuthConfig();
  return Response.json(
    {
      user,
      isAdmin: Boolean(user?.isAdmin),
      adminUsernames: getAdminKickUsernames(),
      kickConfigured: kick.configured,
      kickMissing: kick.missing,
      kickRedirectUri: getKickCallbackUrl(request),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE() {
  await destroySession();
  return Response.json({ ok: true });
}
