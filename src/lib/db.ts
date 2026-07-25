import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import type {
  Coupon,
  CouponStatus,
  CouponWithMember,
  User,
  UserRole,
  WeekStatusRow,
} from "./types";

const DATA_DIR =
  process.env.DATA_DIR || path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "strikeclub.db");

declare global {
  // eslint-disable-next-line no-var
  var __strikeDb: DatabaseSync | undefined;
}

function rowToUser(row: Record<string, unknown>): User {
  return {
    id: Number(row.id),
    email: String(row.email),
    name: String(row.name),
    role: row.role as UserRole,
    createdAt: String(row.created_at),
  };
}

function rowToCoupon(row: Record<string, unknown>): Coupon {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    code: String(row.code),
    weekStart: String(row.week_start),
    games: Number(row.games),
    status: row.status as CouponStatus,
    createdAt: String(row.created_at),
    redeemedAt: row.redeemed_at ? String(row.redeemed_at) : null,
    redeemedByStaffId: row.redeemed_by_staff_id
      ? Number(row.redeemed_by_staff_id)
      : null,
  };
}

function seedStaff(db: DatabaseSync) {
  const existing = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get("staff@strikeclub.local");
  if (existing) return;

  const hash = bcrypt.hashSync("change-me", 10);
  db.prepare(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES (?, ?, ?, ?)`,
  ).run("staff@strikeclub.local", hash, "Front Desk", "staff");
}

function migrate(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('member', 'staff')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      code TEXT NOT NULL UNIQUE,
      week_start TEXT NOT NULL,
      games INTEGER NOT NULL DEFAULT 3,
      status TEXT NOT NULL CHECK (status IN ('active', 'redeemed', 'expired')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      redeemed_at TEXT,
      redeemed_by_staff_id INTEGER REFERENCES users(id),
      UNIQUE (user_id, week_start)
    );

    CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
    CREATE INDEX IF NOT EXISTS idx_coupons_user ON coupons(user_id);
    CREATE INDEX IF NOT EXISTS idx_coupons_status ON coupons(status);
  `);
  seedStaff(db);
}

export function getDb(): DatabaseSync {
  if (globalThis.__strikeDb) return globalThis.__strikeDb;

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA foreign_keys = ON;");
  migrate(db);
  globalThis.__strikeDb = db;
  return db;
}

export function findUserByEmail(email: string): (User & { passwordHash: string }) | null {
  const row = getDb()
    .prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE")
    .get(email.trim()) as Record<string, unknown> | undefined;
  if (!row) return null;
  return { ...rowToUser(row), passwordHash: String(row.password_hash) };
}

export function findUserById(id: number): User | null {
  const row = getDb()
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToUser(row);
}

export function createMember(input: {
  email: string;
  password: string;
  name: string;
}): User {
  const hash = bcrypt.hashSync(input.password, 10);
  const result = getDb()
    .prepare(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES (?, ?, ?, 'member')`,
    )
    .run(input.email.trim().toLowerCase(), hash, input.name.trim());

  const user = findUserById(Number(result.lastInsertRowid));
  if (!user) throw new Error("Failed to create user");
  return user;
}

export function getCouponByUserAndWeek(
  userId: number,
  weekStart: string,
): Coupon | null {
  const row = getDb()
    .prepare("SELECT * FROM coupons WHERE user_id = ? AND week_start = ?")
    .get(userId, weekStart) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToCoupon(row);
}

export function getCouponByCode(code: string): Coupon | null {
  const row = getDb()
    .prepare("SELECT * FROM coupons WHERE code = ? COLLATE NOCASE")
    .get(code.trim().toUpperCase()) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToCoupon(row);
}

export function insertCoupon(input: {
  userId: number;
  code: string;
  weekStart: string;
  games?: number;
}): Coupon {
  const result = getDb()
    .prepare(
      `INSERT INTO coupons (user_id, code, week_start, games, status)
       VALUES (?, ?, ?, ?, 'active')`,
    )
    .run(
      input.userId,
      input.code.toUpperCase(),
      input.weekStart,
      input.games ?? 3,
    );

  const row = getDb()
    .prepare("SELECT * FROM coupons WHERE id = ?")
    .get(Number(result.lastInsertRowid)) as Record<string, unknown>;
  return rowToCoupon(row);
}

export function expireStaleCoupons(currentWeekStart: string) {
  getDb()
    .prepare(
      `UPDATE coupons
       SET status = 'expired'
       WHERE status = 'active' AND week_start < ?`,
    )
    .run(currentWeekStart);
}

export function listCouponsForUser(userId: number): Coupon[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM coupons
       WHERE user_id = ?
       ORDER BY week_start DESC`,
    )
    .all(userId) as Record<string, unknown>[];
  return rows.map(rowToCoupon);
}

export function lookupCoupons(query: string): CouponWithMember[] {
  const q = query.trim();
  if (!q) return [];

  const like = `%${q}%`;
  const rows = getDb()
    .prepare(
      `SELECT
         c.*,
         u.name AS member_name,
         u.email AS member_email,
         s.name AS redeemed_by_name
       FROM coupons c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN users s ON s.id = c.redeemed_by_staff_id
       WHERE c.code LIKE ? COLLATE NOCASE
          OR u.email LIKE ? COLLATE NOCASE
          OR u.name LIKE ? COLLATE NOCASE
       ORDER BY c.week_start DESC
       LIMIT 25`,
    )
    .all(like, like, like) as Record<string, unknown>[];

  return rows.map((row) => ({
    ...rowToCoupon(row),
    memberName: String(row.member_name),
    memberEmail: String(row.member_email),
    redeemedByName: row.redeemed_by_name
      ? String(row.redeemed_by_name)
      : null,
  }));
}

export function redeemCoupon(
  couponId: number,
  staffId: number,
): Coupon | null {
  const now = new Date().toISOString();
  const result = getDb()
    .prepare(
      `UPDATE coupons
       SET status = 'redeemed',
           redeemed_at = ?,
           redeemed_by_staff_id = ?
       WHERE id = ? AND status = 'active'`,
    )
    .run(now, staffId, couponId);

  if (result.changes === 0) return null;

  const row = getDb()
    .prepare("SELECT * FROM coupons WHERE id = ?")
    .get(couponId) as Record<string, unknown>;
  return rowToCoupon(row);
}

export function recentRedemptions(limit = 20): CouponWithMember[] {
  const rows = getDb()
    .prepare(
      `SELECT
         c.*,
         u.name AS member_name,
         u.email AS member_email,
         s.name AS redeemed_by_name
       FROM coupons c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN users s ON s.id = c.redeemed_by_staff_id
       WHERE c.status = 'redeemed'
       ORDER BY c.redeemed_at DESC
       LIMIT ?`,
    )
    .all(limit) as Record<string, unknown>[];

  return rows.map((row) => ({
    ...rowToCoupon(row),
    memberName: String(row.member_name),
    memberEmail: String(row.member_email),
    redeemedByName: row.redeemed_by_name
      ? String(row.redeemed_by_name)
      : null,
  }));
}

export function getCouponWithMember(code: string): CouponWithMember | null {
  const row = getDb()
    .prepare(
      `SELECT
         c.*,
         u.name AS member_name,
         u.email AS member_email,
         s.name AS redeemed_by_name
       FROM coupons c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN users s ON s.id = c.redeemed_by_staff_id
       WHERE c.code = ? COLLATE NOCASE`,
    )
    .get(code.trim().toUpperCase()) as Record<string, unknown> | undefined;

  if (!row) return null;
  return {
    ...rowToCoupon(row),
    memberName: String(row.member_name),
    memberEmail: String(row.member_email),
    redeemedByName: row.redeemed_by_name
      ? String(row.redeemed_by_name)
      : null,
  };
}

/** Members matching name, with this week's coupon redemption status. */
export function searchWeekStatusByName(
  nameQuery: string,
  weekStart: string,
): WeekStatusRow[] {
  const q = nameQuery.trim();
  if (!q) return [];

  const like = `%${q}%`;
  const rows = getDb()
    .prepare(
      `SELECT
         u.id AS member_id,
         u.name AS member_name,
         u.email AS member_email,
         c.id AS coupon_id,
         c.user_id AS coupon_user_id,
         c.code AS coupon_code,
         c.week_start AS coupon_week_start,
         c.games AS coupon_games,
         c.status AS coupon_status,
         c.created_at AS coupon_created_at,
         c.redeemed_at AS coupon_redeemed_at,
         c.redeemed_by_staff_id AS coupon_redeemed_by_staff_id,
         s.name AS redeemed_by_name
       FROM users u
       LEFT JOIN coupons c
         ON c.user_id = u.id AND c.week_start = ?
       LEFT JOIN users s ON s.id = c.redeemed_by_staff_id
       WHERE u.role = 'member'
         AND u.name LIKE ? COLLATE NOCASE
       ORDER BY u.name ASC
       LIMIT 25`,
    )
    .all(weekStart, like) as Record<string, unknown>[];

  return rows.map((row) => {
    const hasCoupon = row.coupon_id != null;
    const coupon: CouponWithMember | null = hasCoupon
      ? {
          id: Number(row.coupon_id),
          userId: Number(row.coupon_user_id),
          code: String(row.coupon_code),
          weekStart: String(row.coupon_week_start),
          games: Number(row.coupon_games),
          status: row.coupon_status as CouponStatus,
          createdAt: String(row.coupon_created_at),
          redeemedAt: row.coupon_redeemed_at
            ? String(row.coupon_redeemed_at)
            : null,
          redeemedByStaffId: row.coupon_redeemed_by_staff_id
            ? Number(row.coupon_redeemed_by_staff_id)
            : null,
          memberName: String(row.member_name),
          memberEmail: String(row.member_email),
          redeemedByName: row.redeemed_by_name
            ? String(row.redeemed_by_name)
            : null,
        }
      : null;

    return {
      memberId: Number(row.member_id),
      memberName: String(row.member_name),
      memberEmail: String(row.member_email),
      weekStart,
      redeemedThisWeek: coupon?.status === "redeemed",
      coupon,
    };
  });
}
