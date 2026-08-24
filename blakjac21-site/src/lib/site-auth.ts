import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export type SiteUser = {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: string;
};

export type PublicSiteUser = {
  id: string;
  username: string;
  email: string;
  createdAt: string;
};

type StoreGlobal = typeof globalThis & {
  __siteUsers?: SiteUser[];
};

const COOKIE_NAME = "blakjac21_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 14;

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

function hashPassword(password: string, salt?: string): string {
  const usedSalt = salt ?? randomBytes(16).toString("hex");
  const hash = scryptSync(password, usedSalt, 64).toString("hex");
  return `${usedSalt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (next.length !== expected.length) return false;
  return timingSafeEqual(next, expected);
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

function verifyToken(token: string): { userId: string; exp: number } | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const data = decodePayload<{ userId: string; exp: number }>(payload);
  if (!data?.userId || !data.exp) return null;
  if (Date.now() > data.exp) return null;
  return data;
}

function toPublic(user: SiteUser): PublicSiteUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
  };
}

function findByEmail(email: string): SiteUser | undefined {
  const normalized = email.trim().toLowerCase();
  return users().find((user) => user.email === normalized);
}

function findByUsername(username: string): SiteUser | undefined {
  const normalized = username.trim().toLowerCase();
  return users().find((user) => user.username === normalized);
}

function findById(id: string): SiteUser | undefined {
  return users().find((user) => user.id === id);
}

export async function createSession(userId: string) {
  const payload = encodePayload({
    userId,
    exp: Date.now() + MAX_AGE_SEC * 1000,
  });
  const token = `${payload}.${sign(payload)}`;
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
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

  const user = findById(data.userId);
  return user ? toPublic(user) : null;
}

export class SiteAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function registerAccount(input: {
  username: string;
  email: string;
  password: string;
}): Promise<PublicSiteUser> {
  const username = input.username.trim().toLowerCase();
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    throw new SiteAuthError(
      "Username must be 3–24 characters (letters, numbers, underscore)",
      400,
    );
  }
  if (!email || !email.includes("@") || email.length > 120) {
    throw new SiteAuthError("Enter a valid email", 400);
  }
  if (password.length < 6 || password.length > 100) {
    throw new SiteAuthError("Password must be 6–100 characters", 400);
  }
  if (findByUsername(username)) {
    throw new SiteAuthError("That username is already taken", 409);
  }
  if (findByEmail(email)) {
    throw new SiteAuthError("An account with that email already exists", 409);
  }

  const user: SiteUser = {
    id: `${Date.now()}-${randomBytes(4).toString("hex")}`,
    username,
    email,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  users().push(user);
  await createSession(user.id);
  return toPublic(user);
}

export async function loginAccount(input: {
  email: string;
  password: string;
}): Promise<PublicSiteUser> {
  const user = findByEmail(input.email);
  if (!user || !verifyPassword(input.password, user.passwordHash)) {
    throw new SiteAuthError("Invalid email or password", 401);
  }
  await createSession(user.id);
  return toPublic(user);
}
