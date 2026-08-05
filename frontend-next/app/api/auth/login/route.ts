import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import {
  consumeRateLimit,
  createSession,
  normalizedEmail,
  SESSION_COOKIE,
  sessionCookieOptions
} from "../../../../lib/auth";
import { getPool } from "../../../../lib/db";
import { assertSameOrigin, requestIp } from "../../../../lib/request";

const DUMMY_HASH = "$2b$12$lQAEeVgLq1f7nNcxz6A19u/wCgh4hfTi2qvYozqzDAt2JplQyhj5G";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const body = (await request.json()) as Record<string, unknown>;
    const email = normalizedEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";
    const allowed = await consumeRateLimit(`login:${requestIp(request)}:${email}`, 10, 15);
    if (!allowed) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });

    const result = await getPool().query<{
      id: string;
      password_hash: string;
      email_verified_at: Date | null;
      disabled_at: Date | null;
    }>(
      `SELECT id, password_hash, email_verified_at, disabled_at
         FROM users WHERE lower(email) = $1`,
      [email]
    );
    const user = result.rows[0];
    const matches = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !matches || user.disabled_at) {
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    }
    if (!user.email_verified_at) {
      return NextResponse.json({ error: "Verify your email before signing in." }, { status: 403 });
    }

    const session = await createSession(user.id);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
    return response;
  } catch (error) {
    console.error("Login failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "We could not sign you in." }, { status: 500 });
  }
}

