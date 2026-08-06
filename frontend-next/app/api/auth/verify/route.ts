import { NextRequest, NextResponse } from "next/server";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "../../../../lib/auth";
import { getPool } from "../../../../lib/db";
import { publicUrl } from "../../../../lib/public-url";
import { sha256 } from "../../../../lib/security";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const destination = publicUrl("/account/login", request.nextUrl.origin);
  if (!token) {
    destination.searchParams.set("error", "invalid-token");
    return NextResponse.redirect(destination);
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM auth_tokens
        WHERE token_hash = $1 AND purpose = 'verify_email' AND used_at IS NULL AND expires_at > now()
        FOR UPDATE`,
      [sha256(token)]
    );
    const authToken = result.rows[0];
    if (!authToken) {
      await client.query("ROLLBACK");
      destination.searchParams.set("error", "invalid-token");
      return NextResponse.redirect(destination);
    }
    await client.query("UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()), updated_at = now() WHERE id = $1", [authToken.user_id]);
    await client.query("UPDATE auth_tokens SET used_at = now() WHERE id = $1", [authToken.id]);
    await client.query("COMMIT");

    const session = await createSession(authToken.user_id);
    const accountUrl = publicUrl("/account?verified=1", request.nextUrl.origin);
    const response = NextResponse.redirect(accountUrl);
    response.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
    return response;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Email verification failed", error instanceof Error ? error.message : error);
    destination.searchParams.set("error", "verification-failed");
    return NextResponse.redirect(destination);
  } finally {
    client.release();
  }
}
