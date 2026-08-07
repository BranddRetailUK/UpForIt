import { NextRequest, NextResponse } from "next/server";
import { getUserForSessionToken, SESSION_COOKIE } from "../../../../lib/auth";
import { getPool } from "../../../../lib/db";
import { assertSameOrigin } from "../../../../lib/request";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await getUserForSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
    if (!user) return NextResponse.json({ error: "Sign in to update your account." }, { status: 401 });

    const body = await request.json() as Record<string, unknown>;
    const displayName = typeof body.displayName === "string"
      ? body.displayName.trim().replace(/\s+/g, " ")
      : "";
    if (displayName.length < 2 || displayName.length > 80) {
      return NextResponse.json({ error: "Enter a name between 2 and 80 characters." }, { status: 400 });
    }

    const result = await getPool().query<{ display_name: string }>(
      `UPDATE users
          SET display_name = $2, updated_at = now()
        WHERE id = $1 AND disabled_at IS NULL
        RETURNING display_name`,
      [user.id, displayName]
    );
    if (!result.rows[0]) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    return NextResponse.json({ ok: true, displayName: result.rows[0].display_name });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid request origin") {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
    console.error("[account-profile]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "We could not update your account." }, { status: 500 });
  }
}
