import { completeKickOAuthLogin, SiteAuthError } from "@/lib/site-auth";
import { getRequestOrigin } from "@/lib/site-url";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim() ?? "";
  const state = url.searchParams.get("state")?.trim() ?? "";
  const oauthError = url.searchParams.get("error");
  const origin = getRequestOrigin(request);

  if (oauthError) {
    const target = new URL("/account", origin);
    target.searchParams.set(
      "error",
      url.searchParams.get("error_description") || oauthError,
    );
    return Response.redirect(target, 302);
  }

  if (!code || !state) {
    const target = new URL("/account", origin);
    target.searchParams.set("error", "Kick login was cancelled or incomplete");
    return Response.redirect(target, 302);
  }

  try {
    await completeKickOAuthLogin({ code, state });
    return Response.redirect(new URL("/", origin), 302);
  } catch (err) {
    const target = new URL("/account", origin);
    target.searchParams.set(
      "error",
      err instanceof SiteAuthError ? err.message : "Kick login failed",
    );
    return Response.redirect(target, 302);
  }
}
