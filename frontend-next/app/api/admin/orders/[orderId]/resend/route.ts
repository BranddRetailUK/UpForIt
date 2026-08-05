import { NextRequest, NextResponse } from "next/server";
import { getStaffForRequest } from "../../../../../../lib/admin-auth";
import { getPool } from "../../../../../../lib/db";
import { enqueueEmail } from "../../../../../../lib/email-jobs";
import { assertSameOrigin } from "../../../../../../lib/request";

export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await params;
    assertSameOrigin(request);
    const staff = await getStaffForRequest(request);
    if (!staff) return NextResponse.json({ error: "Staff access required." }, { status: 403 });
    const result = await getPool().query<{ user_id: string; email: string; display_name: string }>(
      `SELECT o.user_id, u.email, u.display_name
         FROM ticket_orders o JOIN users u ON u.id = o.user_id
        WHERE o.id = $1 AND o.status = 'paid'`,
      [orderId]
    );
    const order = result.rows[0];
    if (!order) return NextResponse.json({ error: "Paid order not found." }, { status: 404 });
    await enqueueEmail(
      "ticket_confirmation",
      { to: order.email, displayName: order.display_name, orderId },
      { userId: order.user_id, orderId }
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Ticket resend failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Ticket resend failed." }, { status: 500 });
  }
}
