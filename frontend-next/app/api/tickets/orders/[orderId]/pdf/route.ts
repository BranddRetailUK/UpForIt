import { GUEST_COOKIE, canAccessGuestOrder, validGuestDownloadToken } from "../../../../../../lib/ticket-guest-access";
import { UUID_PATTERN } from "../../../../../../lib/ticket-checkout-input";
import { NextRequest, NextResponse } from "next/server";
import { getUserForSessionToken, SESSION_COOKIE } from "../../../../../../lib/auth";
import { getPool } from "../../../../../../lib/db";
import { buildTicketPdf } from "../../../../../../lib/ticket-document";

export async function GET(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const user = await getUserForSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!UUID_PATTERN.test(orderId)) return new NextResponse("Not found", {status:404});
  const result = await getPool().query<{ user_id: string | null; guest_access_hash: string | null; order_number: string; status: string; admissions_hold: boolean }>(
    "SELECT user_id, guest_access_hash, order_number, status, admissions_hold FROM ticket_orders WHERE id = $1",
    [orderId]
  );
  const order = result.rows[0];
  if (!order || !(user && (order.user_id === user.id || user.role === "admin")) && !canAccessGuestOrder(order,request.cookies.get(GUEST_COOKIE)?.value) && !(!order.user_id && validGuestDownloadToken(orderId,request.nextUrl.searchParams.get("guest_token")))) return new NextResponse("Not found", { status: 404 });
  if (order.admissions_hold || !["paid", "refund_review"].includes(order.status)) return new NextResponse("Tickets are not available for this order", { status: 409 });
  const pdf = await buildTicketPdf(orderId);
  return new NextResponse(pdf, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="UPFORIT-${order.order_number}.pdf"`,
      "cache-control": "private, no-store",
      "referrer-policy": "no-referrer"
    }
  });
}
