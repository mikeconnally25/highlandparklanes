import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { createMember, findUserByEmail, findUserById } from "./db";
import type { SessionUser, UserRole } from "./types";

const COOKIE_NAME = "strike_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 14; // 14 days

function sessionSecret() {
  return (
    process.env.SESSION_SECRET || "dev-strike-club-secret-change-me-in-production"
  );
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

function verify(token: string): { userId: number; exp: number } | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const data = decodePayload<{ userId: number; exp: number }>(payload);
  if (!data?.userId || !data.exp) return null;
  if (Date.now() > data.exp) return null;
  return data;
}

export async function createSession(userId: number) {
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

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const data = verify(token);
  if (!data) return null;

  const user = findUserById(data.userId);
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export async function requireUser(role?: UserRole): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError("Not signed in", 401);
  if (role && user.role !== role) {
    throw new AuthError("Forbidden", 403);
  }
  return user;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function signup(input: {
  email: string;
  password: string;
  name: string;
}): Promise<SessionUser> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const password = input.password;

  if (!email || !email.includes("@")) {
    throw new AuthError("Enter a valid email", 400);
  }
  if (name.length < 2) {
    throw new AuthError("Name must be at least 2 characters", 400);
  }
  if (password.length < 6) {
    throw new AuthError("Password must be at least 6 characters", 400);
  }
  if (findUserByEmail(email)) {
    throw new AuthError("An account with that email already exists", 409);
  }

  const user = createMember({ email, password, name });
  await createSession(user.id);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<SessionUser> {
  const user = findUserByEmail(input.email);
  if (!user || !bcrypt.compareSync(input.password, user.passwordHash)) {
    throw new AuthError("Invalid email or password", 401);
  }

  await createSession(user.id);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}
