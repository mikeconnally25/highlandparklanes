import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";

export type SiteUser = {
  id: string;
  kickUserId: string;
  username: string;
  email: string | null;
  profilePicture: string | null;
  createdAt: string;
  lastLoginAt: string;
};

export type PublicSiteUser = {
  id: string;
  kickUserId: string;
  username: string;
  email: string | null;
  profilePicture: string | null;
  createdAt: string;
  isAdmin: boolean;
};

type StoreGlobal = typeof globalThis & {
  __siteUsers?: SiteUser[];
};

const COOKIE_NAME = "blakjac21_session";
const OAUTH_COOKIE = "blakjac21_kick_oauth";
const MAX_AGE_SEC = 60 * 60 * 24 * 14;

const KICK_AUTHORIZE = "https://id.kick.com/oauth/authorize";
const KICK_TOKEN = "https://id.kick.com/oauth/token";
const KICK_USERS = "https://api.kick.com/public/v1/users";

function users(): SiteUser[] {
  const g = globalThis as StoreGlobal;
  if (!g.__siteUsers) g.__siteUsers = [];
  return g.__siteUsers;
}

function sessionSecret() {
  return (
    process.env.SESSION_SECRET ||
    process.env.GUESS_ADMIN_TOKEN ||
    "dev-blakjac21-session-secret-change-me"
  );
}

export function getKickOAuthConfig() {
  const clientId = process.env.KICK_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.KICK_CLIENT_SECRET?.trim() ?? "";
  const redirectUri =
    process.env.KICK_REDIRECT_URI?.trim() ||
    (process.env.NEXT_PUBLIC_SITE_URL
      ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/api/account/kick/callback`
      : "");

  const missing: string[] = [];
  if (!clientId) missing.push("KICK_CLIENT_ID");
  if (!clientSecret) missing.push("KICK_CLIENT_SECRET");
  // Redirect can also be inferred from the request origin at login time.
  if (!redirectUri && !process.env.NEXT_PUBLIC_SITE_URL?.trim()) {
    missing.push("KICK_REDIRECT_URI or NEXT_PUBLIC_SITE_URL");
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    missing,
    configured: Boolean(clientId && clientSecret),
  };
}

function encodePayload(data: object) {
  return Buffer.from(JSON.stringify(data), "utf8").toString("base64url");
}

function decodePayload<T>(raw: string): T | null {
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function sign(payload: string) {
  return createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("base64url");
}

type SessionToken = {
  userId: string;
  exp: number;
  /** Snapshot so sessions survive serverless cold starts / new instances. */
  user?: {
    id: string;
    kickUserId: string;
    username: string;
    email: string | null;
    profilePicture: string | null;
    createdAt: string;
  };
};

function verifyToken(token: string): SessionToken | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const data = decodePayload<SessionToken>(payload);
  if (!data?.userId || !data.exp) return null;
  if (Date.now() > data.exp) return null;
  return data;
}

/** Comma-separated Kick usernames allowed as streamer admin (case-insensitive). */
export function getAdminKickUsernames(): string[] {
  const raw =
    process.env.ADMIN_KICK_USERNAME?.trim() ||
    process.env.KICK_CHANNEL_SLUG?.trim() ||
    "Blakjac21";
  return raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

/** Optional comma-separated Kick user IDs (more precise than username). */
export function getAdminKickUserIds(): string[] {
  const raw = process.env.ADMIN_KICK_USER_ID?.trim() || "";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isAdminKickUser(user: {
  username: string;
  kickUserId: string;
}): boolean {
  const ids = getAdminKickUserIds();
  if (ids.includes(user.kickUserId)) return true;
  return getAdminKickUsernames().includes(user.username.trim().toLowerCase());
}

function toPublic(user: SiteUser): PublicSiteUser {
  return {
    id: user.id,
    kickUserId: user.kickUserId,
    username: user.username,
    email: user.email,
    profilePicture: user.profilePicture,
    createdAt: user.createdAt,
    isAdmin: isAdminKickUser(user),
  };
}

/** True when the logged-in Kick account is the streamer admin. */
export async function isSessionStreamerAdmin(): Promise<boolean> {
  const user = await getSessionUser();
  return Boolean(user?.isAdmin);
}

/**
 * Authorize streamer controls: Kick admin session, or legacy GUESS_ADMIN_TOKEN
 * header for scripts / emergency access.
 */
export async function authorizeStreamerAdmin(
  request: Request,
): Promise<boolean> {
  if (await isSessionStreamerAdmin()) return true;

  const expected = process.env.GUESS_ADMIN_TOKEN;
  if (!expected) return false;
  return request.headers.get("x-admin-token") === expected;
}

function findByKickUserId(kickUserId: string): SiteUser | undefined {
  return users().find((user) => user.kickUserId === kickUserId);
}

function findById(id: string): SiteUser | undefined {
  return users().find((user) => user.id === id);
}

function upsertMemoryUser(snapshot: SiteUser): SiteUser {
  const existing = findById(snapshot.id) || findByKickUserId(snapshot.kickUserId);
  if (existing) {
    existing.username = snapshot.username;
    existing.email = snapshot.email;
    existing.profilePicture = snapshot.profilePicture;
    existing.kickUserId = snapshot.kickUserId;
    existing.lastLoginAt = snapshot.lastLoginAt;
    return existing;
  }
  users().push(snapshot);
  return snapshot;
}

export async function createSession(user: SiteUser) {
  const payload = encodePayload({
    userId: user.id,
    exp: Date.now() + MAX_AGE_SEC * 1000,
    user: {
      id: user.id,
      kickUserId: user.kickUserId,
      username: user.username,
      email: user.email,
      profilePicture: user.profilePicture,
      createdAt: user.createdAt,
    },
  } satisfies SessionToken);
  const token = `${payload}.${sign(payload)}`;
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    // Always secure in production/deployed HTTPS; keep false for local http
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionUser(): Promise<PublicSiteUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const data = verifyToken(token);
  if (!data) return null;

  let user = findById(data.userId);
  if (!user && data.user) {
    user = upsertMemoryUser({
      id: data.user.id,
      kickUserId: data.user.kickUserId,
      username: data.user.username,
      email: data.user.email,
      profilePicture: data.user.profilePicture,
      createdAt: data.user.createdAt,
      lastLoginAt: new Date().toISOString(),
    });
  }
  if (!user) return null;
  return toPublic(user);
}

export class SiteAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function base64Url(buffer: Buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createPkcePair() {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(
    createHash("sha256").update(verifier).digest(),
  );
  return { verifier, challenge };
}

export async function beginKickOAuthLogin(options?: {
  redirectUri?: string;
}): Promise<string> {
  const config = getKickOAuthConfig();
  const redirectUri = options?.redirectUri?.trim() || config.redirectUri;
  if (!config.clientId || !config.clientSecret || !redirectUri) {
    throw new SiteAuthError(
      "Kick login is not configured. Set KICK_CLIENT_ID, KICK_CLIENT_SECRET, and KICK_REDIRECT_URI (or NEXT_PUBLIC_SITE_URL).",
      503,
    );
  }

  const { verifier, challenge } = createPkcePair();
  const state = base64Url(randomBytes(24));
  const jar = await cookies();
  jar.set(
    OAUTH_COOKIE,
    encodePayload({
      state,
      verifier,
      redirectUri,
      exp: Date.now() + 10 * 60 * 1000,
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    },
  );

  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: redirectUri,
    scope: "user:read",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  return `${KICK_AUTHORIZE}?${params.toString()}`;
}

type KickTokenResponse = {
  access_token?: string;
  token_type?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

type KickUserPayload = {
  user_id?: number | string;
  name?: string;
  email?: string;
  profile_picture?: string;
};

export async function completeKickOAuthLogin(input: {
  code: string;
  state: string;
}): Promise<PublicSiteUser> {
  const config = getKickOAuthConfig();
  if (!config.configured) {
    throw new SiteAuthError("Kick login is not configured", 503);
  }

  const jar = await cookies();
  const raw = jar.get(OAUTH_COOKIE)?.value;
  jar.set(OAUTH_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });

  if (!raw) {
    throw new SiteAuthError("Kick login session expired — try again", 400);
  }

  const oauth = decodePayload<{
    state: string;
    verifier: string;
    redirectUri?: string;
    exp: number;
  }>(raw);

  if (!oauth?.state || !oauth.verifier || Date.now() > oauth.exp) {
    throw new SiteAuthError("Kick login session expired — try again", 400);
  }
  if (oauth.state !== input.state) {
    throw new SiteAuthError("Invalid Kick login state", 400);
  }

  const redirectUri = oauth.redirectUri || config.redirectUri;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: redirectUri,
    code_verifier: oauth.verifier,
    code: input.code,
  });

  const tokenRes = await fetch(KICK_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const tokenJson = (await tokenRes.json()) as KickTokenResponse;
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new SiteAuthError(
      tokenJson.error_description ||
        tokenJson.error ||
        "Could not complete Kick login",
      400,
    );
  }

  const userRes = await fetch(KICK_USERS, {
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  const userJson = (await userRes.json()) as {
    data?: KickUserPayload[];
    message?: string;
  };
  const kickUser = userJson.data?.[0];
  if (!userRes.ok || !kickUser?.user_id || !kickUser.name) {
    throw new SiteAuthError("Could not load Kick profile", 400);
  }

  const kickUserId = String(kickUser.user_id);
  const now = new Date().toISOString();
  let user = findByKickUserId(kickUserId);

  if (user) {
    user.username = kickUser.name;
    user.email = kickUser.email?.trim() || user.email;
    user.profilePicture = kickUser.profile_picture ?? user.profilePicture;
    user.lastLoginAt = now;
  } else {
    user = {
      id: `${Date.now()}-${randomBytes(4).toString("hex")}`,
      kickUserId,
      username: kickUser.name,
      email: kickUser.email?.trim() || null,
      profilePicture: kickUser.profile_picture ?? null,
      createdAt: now,
      lastLoginAt: now,
    };
    users().push(user);
  }

  await createSession(user);
  return toPublic(user);
}
