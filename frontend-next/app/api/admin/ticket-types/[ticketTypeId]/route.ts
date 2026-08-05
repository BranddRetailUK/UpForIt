import { NextRequest, NextResponse } from "next/server";
import { getStaffForRequest } from "../../../../../lib/admin-auth";
import { getPool } from "../../../../../lib/db";
import { assertSameOrigin } from "../../../../../lib/request";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ ticketTypeId: string }> }) {
  try {
    const { ticketTypeId } = await params;
    assertSameOrigin(request);
    const staff = await getStaffForRequest(request);
    if (!staff) return NextResponse.json({ error: "Staff access required." }, { status: 403 });
    const body = (await request.json()) as { active?: unknown };
    if (typeof body.active !== "boolean") return NextResponse.json({ error: "Invalid tier state." }, { status: 400 });
    const result = await getPool().query(
      "UPDATE ticket_types SET is_active = $2, updated_at = now() WHERE id = $1 RETURNING id",
      [ticketTypeId, body.active]
    );
    if (!result.rowCount) return NextResponse.json({ error: "Ticket tier not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Tier update failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Tier update failed." }, { status: 500 });
  }
}
