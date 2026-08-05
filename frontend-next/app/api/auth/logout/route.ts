import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "../../../../lib/auth";
import { getPool } from "../../../../lib/db";
import { assertSameOrigin } from "../../../../lib/request";
import { sha256 } from "../../../../lib/security";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (token) await getPool().query("DELETE FROM user_sessions WHERE token_hash = $1", [sha256(token)]);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, "", { path: "/", expires: new Date(0) });
    return response;
  } catch {
    return NextResponse.json({ error: "We could not sign you out." }, { status: 500 });
  }
}

