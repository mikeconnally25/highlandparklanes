import { beginKickOAuthLogin, SiteAuthError } from "@/lib/site-auth";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  try {
    const redirectUri =
      process.env.KICK_REDIRECT_URI?.trim() ||
      `${origin}/api/account/kick/callback`;
    const url = await beginKickOAuthLogin({ redirectUri });
    return Response.redirect(url, 302);
  } catch (err) {
    const target = new URL("/account", origin);
    target.searchParams.set(
      "error",
      err instanceof SiteAuthError
        ? err.message
        : "Kick login failed to start",
    );
    return Response.redirect(target, 302);
  }
}
