import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { validPassword } from "../../../../lib/auth";
import { getPool } from "../../../../lib/db";
import { assertSameOrigin } from "../../../../lib/request";
import { sha256 } from "../../../../lib/security";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const body = (await request.json()) as Record<string, unknown>;
    const token = typeof body.token === "string" ? body.token : "";
    if (!token || !validPassword(body.password)) {
      return NextResponse.json({ error: "Use a password of at least 12 characters." }, { status: 400 });
    }
    const passwordHash = await bcrypt.hash(body.password, 12);
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<{ id: string; user_id: string }>(
        `SELECT id, user_id FROM auth_tokens
          WHERE token_hash = $1 AND purpose = 'reset_password' AND used_at IS NULL AND expires_at > now()
          FOR UPDATE`,
        [sha256(token)]
      );
      const authToken = result.rows[0];
      if (!authToken) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "That reset link is invalid or expired." }, { status: 400 });
      }
      await client.query("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2", [passwordHash, authToken.user_id]);
      await client.query("UPDATE auth_tokens SET used_at = now() WHERE id = $1", [authToken.id]);
      await client.query("DELETE FROM user_sessions WHERE user_id = $1", [authToken.user_id]);
      await client.query("COMMIT");
      return NextResponse.json({ ok: true });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Password reset failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "We could not reset your password." }, { status: 500 });
  }
}
