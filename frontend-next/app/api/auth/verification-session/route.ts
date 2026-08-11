import { NextRequest, NextResponse } from "next/server";
import {
  createSessionForUser,
  SESSION_COOKIE,
  sessionCookieOptions
} from "../../../../lib/auth";
import { getPool } from "../../../../lib/db";
import { assertSameOrigin } from "../../../../lib/request";
import { sha256 } from "../../../../lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const client = await getPool().connect();
  try {
    assertSameOrigin(request);
    const body = (await request.json()) as Record<string, unknown>;
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) return NextResponse.json({ error: "Verification session unavailable." }, { status: 400 });

    await client.query("BEGIN");
    const result = await client.query<{
      id: string;
      user_id: string;
      email_verified_at: Date | null;
    }>(
      `SELECT t.id, t.user_id, u.email_verified_at
         FROM auth_tokens t
         JOIN users u ON u.id = t.user_id
        WHERE t.token_hash = $1
          AND t.purpose = 'signup_session'
          AND t.used_at IS NULL
          AND t.expires_at > now()
          AND u.disabled_at IS NULL
        FOR UPDATE OF t`,
      [sha256(token)]
    );
    const handoff = result.rows[0];
    if (!handoff) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Verification session unavailable." }, { status: 410 });
    }
    if (!handoff.email_verified_at) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { verified: false },
        { headers: { "cache-control": "private, no-store" } }
      );
    }

    const session = await createSessionForUser(client, handoff.user_id);
    await client.query("UPDATE auth_tokens SET used_at = now() WHERE id = $1", [handoff.id]);
    await client.query("COMMIT");

    const response = NextResponse.json(
      { verified: true },
      { headers: { "cache-control": "private, no-store" } }
    );
    response.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
    return response;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Verification session polling failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Verification status is temporarily unavailable." }, { status: 500 });
  } finally {
    client.release();
  }
}
