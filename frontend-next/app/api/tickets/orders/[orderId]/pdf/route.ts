import { NextRequest, NextResponse } from "next/server";
import { getUserForSessionToken, SESSION_COOKIE } from "../../../../../../lib/auth";
import { getPool } from "../../../../../../lib/db";
import { buildTicketPdf } from "../../../../../../lib/ticket-document";

export async function GET(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const user = await getUserForSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return new NextResponse("Sign in required", { status: 401 });
  const result = await getPool().query<{ user_id: string; order_number: string; status: string }>(
    "SELECT user_id, order_number, status FROM ticket_orders WHERE id = $1",
    [orderId]
  );
  const order = result.rows[0];
  if (!order || (order.user_id !== user.id && user.role !== "admin")) return new NextResponse("Not found", { status: 404 });
  if (order.status !== "paid") return new NextResponse("Tickets are not available for this order", { status: 409 });
  const pdf = await buildTicketPdf(orderId);
  return new NextResponse(pdf, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="UPFORIT-${order.order_number}.pdf"`,
      "cache-control": "private, no-store"
    }
  });
}
