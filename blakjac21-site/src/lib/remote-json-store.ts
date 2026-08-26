/**
 * Optional cross-instance JSON store via Upstash Redis REST.
 * When UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are unset,
 * callers fall back to local file/memory (fine for local `next dev`).
 */

function redisConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

export function hasRemoteJsonStore(): boolean {
  return redisConfig() != null;
}

export async function readRemoteJson<T>(key: string): Promise<T | null> {
  const config = redisConfig();
  if (!config) return null;

  try {
    const res = await fetch(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["GET", `blakjac21:${key}`]),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: string | null };
    if (data.result == null || data.result === "") return null;
    return JSON.parse(data.result) as T;
  } catch {
    return null;
  }
}

export async function writeRemoteJson(
  key: string,
  value: unknown,
): Promise<boolean> {
  const config = redisConfig();
  if (!config) return false;

  try {
    const res = await fetch(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        "SET",
        `blakjac21:${key}`,
        JSON.stringify(value),
      ]),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}
