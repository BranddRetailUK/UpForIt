import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit, createSingleUseToken, normalizedEmail, validPassword } from "../../../../lib/auth";
import { getPool } from "../../../../lib/db";
import { enqueueEmail } from "../../../../lib/email-jobs";
import { verificationUrl } from "../../../../lib/public-url";
import { assertSameOrigin, requestIp } from "../../../../lib/request";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const body = (await request.json()) as Record<string, unknown>;
    const email = normalizedEmail(body.email);
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";

    if (!email.includes("@") || displayName.length < 2 || displayName.length > 80 || !validPassword(password)) {
      return NextResponse.json(
        { error: "Enter your name, a valid email and a password of at least 12 characters." },
        { status: 400 }
      );
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    const allowed = await consumeRateLimit(`register:${requestIp(request)}:${email}`, 5, 60);
    if (!allowed) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });

    const existing = await getPool().query("SELECT id FROM users WHERE lower(email) = $1", [email]);
    if (existing.rowCount) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }

    const userId = randomUUID();
    const passwordHash = await bcrypt.hash(password, 12);
    const bootstrapEmail = normalizedEmail(process.env.ADMIN_BOOTSTRAP_EMAIL);
    const role = bootstrapEmail && email === bootstrapEmail ? "admin" : "customer";
    await getPool().query(
      `INSERT INTO users (id, email, display_name, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, email, displayName, passwordHash, role]
    );

    const token = await createSingleUseToken(userId, "verify_email", 24 * 60);
    const signupSessionToken = await createSingleUseToken(userId, "signup_session", 24 * 60);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) throw new Error("NEXT_PUBLIC_SITE_URL is not set");
    await enqueueEmail(
      "verify_email",
      { to: email, displayName, url: verificationUrl(siteUrl, token, body.next).toString() },
      { userId }
    );

    return NextResponse.json({ ok: true, signupSessionToken });
  } catch (error) {
    console.error("Registration failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "We could not create your account." }, { status: 500 });
  }
}
