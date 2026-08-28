const KICK_CALLBACK_PATH = "/api/account/kick/callback";

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/$/, "");
}

/** Public site origin for the incoming request (handles Vercel/proxy headers). */
export function getRequestOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");

  if (forwardedHost) {
    const host = forwardedHost.split(",")[0]?.trim();
    if (host) {
      const proto = forwardedProto?.split(",")[0]?.trim() || "https";
      return `${proto}://${host}`;
    }
  }

  const host = request.headers.get("host")?.trim();
  if (host) {
    const proto = url.protocol.replace(":", "") || "https";
    return `${proto}://${host}`;
  }

  return url.origin;
}

/** Stable Vercel production hostname (set once per project, survives redeploys). */
export function getVercelProductionOrigin(): string | null {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (!host) return null;
  const normalized = host.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return normalized ? `https://${normalized}` : null;
}

/**
 * Best-effort site origin without a request.
 * Prefer explicit env overrides, then Vercel's stable production hostname.
 */
export function getConfiguredSiteOrigin(): string {
  const redirectUri = process.env.KICK_REDIRECT_URI?.trim();
  if (redirectUri) {
    return normalizeOrigin(
      redirectUri.replace(/\/api\/account\/kick\/callback\/?$/i, ""),
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (siteUrl) return normalizeOrigin(siteUrl);

  const vercel = getVercelProductionOrigin();
  if (vercel) return vercel;

  return "";
}

export function getKickCallbackUrl(request: Request): string {
  return `${normalizeOrigin(getRequestOrigin(request))}${KICK_CALLBACK_PATH}`;
}

/** Kick redirect URL for docs / diagnostics when no request is available. */
export function getConfiguredKickCallbackUrl(): string {
  const redirectUri = process.env.KICK_REDIRECT_URI?.trim();
  if (redirectUri) return normalizeOrigin(redirectUri);

  const origin = getConfiguredSiteOrigin();
  return origin ? `${origin}${KICK_CALLBACK_PATH}` : "";
}
