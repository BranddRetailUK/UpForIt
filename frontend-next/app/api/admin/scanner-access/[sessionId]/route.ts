import { NextRequest, NextResponse } from "next/server";
import { getAdminForRequest } from "../../../../../lib/admin-auth";
import { getPool } from "../../../../../lib/db";
import { assertSameOrigin } from "../../../../../lib/request";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    assertSameOrigin(request);
    const admin = await getAdminForRequest(request);
    if (!admin) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    const { sessionId } = await params;
    if (!UUID_PATTERN.test(sessionId)) {
      return NextResponse.json({ error: "Invalid scanner device." }, { status: 400 });
    }
    const result = await getPool().query(
      `UPDATE scanner_sessions
          SET revoked_at = COALESCE(revoked_at, now()), revoked_by = COALESCE(revoked_by, $2)
        WHERE id = $1`,
      [sessionId, admin.id]
    );
    if (!result.rowCount) return NextResponse.json({ error: "Scanner device not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid request origin") {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
    console.error("Scanner device revocation failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Scanner device could not be revoked." }, { status: 500 });
  }
}
