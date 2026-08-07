import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { getPool } from "./db";
import { randomToken, sha256 } from "./security";

export const SESSION_COOKIE = "upforit_session";
const SESSION_DAYS = 30;

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: "customer" | "staff" | "admin";
  emailVerified: boolean;
};

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  role: AuthUser["role"];
  email_verified_at: Date | null;
};

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    emailVerified: Boolean(row.email_verified_at)
  };
}

export async function createSession(userId: string) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await getPool().query(
    `INSERT INTO user_sessions (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [randomUUID(), userId, sha256(token), expiresAt]
  );
  return { token, expiresAt };
}

export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires
  };
}

export async function getUserForSessionToken(token?: string | null) {
  if (!token) return null;
  const result = await getPool().query<UserRow>(
    `SELECT u.id, u.email, u.display_name, u.role, u.email_verified_at
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now() AND u.disabled_at IS NULL`,
    [sha256(token)]
  );
  return result.rows[0] ? toAuthUser(result.rows[0]) : null;
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  return getUserForSessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("AUTH_REQUIRED");
  return user;
}

export async function createSingleUseToken(
  userId: string,
  purpose: "verify_email" | "reset_password",
  lifetimeMinutes: number
) {
  const token = randomToken();
  await getPool().query(
    `INSERT INTO auth_tokens (id, user_id, purpose, token_hash, expires_at)
     VALUES ($1, $2, $3, $4, now() + ($5 * interval '1 minute'))`,
    [randomUUID(), userId, purpose, sha256(token), lifetimeMinutes]
  );
  return token;
}

export function normalizedEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function validPassword(value: unknown): value is string {
  return typeof value === "string" && Buffer.byteLength(value) >= 12 && Buffer.byteLength(value) <= 72;
}

export async function consumeRateLimit(key: string, limit: number, windowMinutes: number) {
  const secret = process.env.AUTH_RATE_LIMIT_SECRET;
  if (!secret) throw new Error("AUTH_RATE_LIMIT_SECRET is not set");
  const bucketKey = sha256(`${secret}:${key}`);
  const result = await getPool().query<{ attempt_count: number }>(
    `INSERT INTO auth_rate_limits (bucket_key, attempt_count, window_started_at)
     VALUES ($1, 1, now())
     ON CONFLICT (bucket_key) DO UPDATE SET
       attempt_count = CASE
         WHEN auth_rate_limits.window_started_at < now() - ($2 * interval '1 minute') THEN 1
         ELSE auth_rate_limits.attempt_count + 1
       END,
       window_started_at = CASE
         WHEN auth_rate_limits.window_started_at < now() - ($2 * interval '1 minute') THEN now()
         ELSE auth_rate_limits.window_started_at
       END
     RETURNING attempt_count`,
    [bucketKey, windowMinutes]
  );
  return (result.rows[0]?.attempt_count ?? limit + 1) <= limit;
}
