import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getStaffForRequest } from "../../../../lib/admin-auth";
import { getPool } from "../../../../lib/db";
import { assertSameOrigin } from "../../../../lib/request";
import { verifyTicketQrToken } from "../../../../lib/security";

type TicketRow = {
  id: string; public_id: string; ticket_number: string; ticket_type_name: string; status: string;
  checked_in_at: Date | null; display_name: string; email: string; event_title: string;
};

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const staff = await getStaffForRequest(request);
    if (!staff) return NextResponse.json({ error: "Staff access required." }, { status: 403 });
    const body = (await request.json()) as { code?: unknown };
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!code) return NextResponse.json({ error: "Scan or enter a ticket code." }, { status: 400 });
    const publicId = verifyTicketQrToken(code);
    if (code.startsWith("v1.") && !publicId) return NextResponse.json({ error: "That QR signature is invalid." }, { status: 400 });

    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<TicketRow>(
        `SELECT t.id, t.public_id, t.ticket_number, t.ticket_type_name, t.status, t.checked_in_at,
                u.display_name, u.email, e.title AS event_title
           FROM tickets t JOIN users u ON u.id = t.user_id JOIN events e ON e.id = t.event_id
          WHERE ${publicId ? "t.public_id = $1" : "upper(t.ticket_number) = upper($1)"}
          FOR UPDATE OF t`,
        [publicId || code]
      );
      const ticket = result.rows[0];
      if (!ticket) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
      }
      if (ticket.status === "void") {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "This ticket is void.", ticket }, { status: 409 });
      }
      if (ticket.status === "checked_in") {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "This ticket has already been checked in.", ticket }, { status: 409 });
      }
      await client.query(
        "UPDATE tickets SET status = 'checked_in', checked_in_at = now(), checked_in_by = $2 WHERE id = $1",
        [ticket.id, staff.id]
      );
      await client.query(
        `INSERT INTO ticket_audit_log (id, actor_user_id, ticket_id, action)
         VALUES ($1, $2, $3, 'checked_in')`,
        [randomUUID(), staff.id, ticket.id]
      );
      await client.query("COMMIT");
      return NextResponse.json({ ok: true, ticket: { ...ticket, status: "checked_in", checked_in_at: new Date() } });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Check-in failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Check-in failed." }, { status: 500 });
  }
}

