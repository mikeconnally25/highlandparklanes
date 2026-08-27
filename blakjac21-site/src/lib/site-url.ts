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

export function getKickCallbackUrl(request: Request): string {
  return `${getRequestOrigin(request).replace(/\/$/, "")}/api/account/kick/callback`;
}
