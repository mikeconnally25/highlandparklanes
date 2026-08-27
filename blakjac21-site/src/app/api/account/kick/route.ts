import { beginKickOAuthLogin, SiteAuthError } from "@/lib/site-auth";
import { getKickCallbackUrl, getRequestOrigin } from "@/lib/site-url";

export async function GET(request: Request) {
  const origin = getRequestOrigin(request);
  try {
    const url = await beginKickOAuthLogin({
      redirectUri: getKickCallbackUrl(request),
    });
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
