import { NextResponse } from "next/server";
import { getPool } from "../../../lib/db";
import { getMetaRequestContext, metaSiteUrl, sendMetaConversion } from "../../../lib/meta";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let email = "";
  let meta: unknown;

  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { email?: string; meta?: unknown };
      email = body?.email ?? "";
      meta = body?.meta;
    } else {
      const formData = await request.formData();
      const value = formData.get("email");
      email = typeof value === "string" ? value : "";
    }
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request payload." },
      { status: 400 }
    );
  }

  const normalized = email.trim().toLowerCase();

  if (!EMAIL_REGEX.test(normalized)) {
    return NextResponse.json(
      { ok: false, error: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  let pool;
  try {
    pool = getPool();
  } catch (error) {
    console.error("Database not configured", error);
    return NextResponse.json(
      { ok: false, error: "Database is not configured." },
      { status: 500 }
    );
  }

  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS signups (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const inserted = await client.query<{ id: number }>(
      "INSERT INTO signups (email) VALUES ($1) ON CONFLICT (email) DO NOTHING RETURNING id",
      [normalized]
    );

    const metaContext = getMetaRequestContext(request, meta);
    if (inserted.rows[0] && metaContext.consent && metaContext.eventId) {
      await sendMetaConversion({
        eventName: "Lead",
        eventId: metaContext.eventId,
        eventSourceUrl: metaSiteUrl("/"),
        contentName: "UPFORIT newsletter",
        userData: {
          email: normalized,
          fbp: metaContext.fbp,
          fbc: metaContext.fbc,
          clientIp: metaContext.clientIp,
          clientUserAgent: metaContext.clientUserAgent
        }
      });
    }

    return NextResponse.json({ ok: true, created: Boolean(inserted.rows[0]) });
  } catch (error) {
    console.error("Signup insert failed", error);
    return NextResponse.json(
      { ok: false, error: "Unable to save your email right now." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
