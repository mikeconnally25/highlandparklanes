import { completeKickOAuthLogin, SiteAuthError } from "@/lib/site-auth";

function siteOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim() ?? "";
  const state = url.searchParams.get("state")?.trim() ?? "";
  const oauthError = url.searchParams.get("error");
  const origin = siteOrigin(request);

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
