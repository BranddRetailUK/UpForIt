import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit, createSingleUseToken, normalizedEmail } from "../../../../lib/auth";
import { getPool } from "../../../../lib/db";
import { enqueueEmail } from "../../../../lib/email-jobs";
import { assertSameOrigin, requestIp } from "../../../../lib/request";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const body = (await request.json()) as Record<string, unknown>;
    const email = normalizedEmail(body.email);
    const allowed = await consumeRateLimit(`forgot:${requestIp(request)}:${email}`, 5, 60);
    if (!allowed) return NextResponse.json({ ok: true });

    const result = await getPool().query<{ id: string; display_name: string }>(
      "SELECT id, display_name FROM users WHERE lower(email) = $1 AND disabled_at IS NULL",
      [email]
    );
    const user = result.rows[0];
    if (user) {
      const token = await createSingleUseToken(user.id, "reset_password", 60);
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
      if (!siteUrl) throw new Error("NEXT_PUBLIC_SITE_URL is not set");
      await enqueueEmail(
        "reset_password",
        { to: email, displayName: user.display_name, url: `${siteUrl}/account/reset-password?token=${encodeURIComponent(token)}` },
        { userId: user.id }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Password reset request failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "We could not process that request." }, { status: 500 });
  }
}

