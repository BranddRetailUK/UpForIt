import { NextResponse } from "next/server";
import { pool } from "../../../lib/db";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let email = "";

  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { email?: string };
      email = body?.email ?? "";
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

  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS signups (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(
      "INSERT INTO signups (email) VALUES ($1) ON CONFLICT (email) DO NOTHING",
      [normalized]
    );

    return NextResponse.json({ ok: true });
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
