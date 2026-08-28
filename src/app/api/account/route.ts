import { getKickOAuthConfig } from "@/lib/site-auth";

/** Legacy email/password signup is disabled — Kick OAuth only. */
export async function POST() {
  const kick = getKickOAuthConfig();
  return Response.json(
    {
      error: "Sign in with your Kick account instead",
      kickConfigured: kick.configured,
      kickLoginUrl: "/api/account/kick",
    },
    { status: 405 },
  );
}
