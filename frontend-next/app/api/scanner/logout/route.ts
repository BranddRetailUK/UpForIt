import { NextRequest, NextResponse } from "next/server";
import { getPool } from "../../../../lib/db";
import { assertSameOrigin } from "../../../../lib/request";
import { SCANNER_SESSION_COOKIE } from "../../../../lib/scanner-access";
import { sha256 } from "../../../../lib/security";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const token = request.cookies.get(SCANNER_SESSION_COOKIE)?.value;
    if (token) {
      await getPool().query(
        "UPDATE scanner_sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE token_hash = $1",
        [sha256(token)]
      );
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SCANNER_SESSION_COOKIE, "", { path: "/", expires: new Date(0) });
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid request origin") {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
    return NextResponse.json({ error: "Scanner access could not be ended." }, { status: 500 });
  }
}
