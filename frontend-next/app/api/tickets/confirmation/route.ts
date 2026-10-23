import { GUEST_COOKIE, canAccessGuestOrder } from "../../../../lib/ticket-guest-access";
import { NextRequest, NextResponse } from "next/server";
import { getUserForSessionToken, SESSION_COOKIE } from "../../../../lib/auth";
import { getPool } from "../../../../lib/db";

export async function GET(request: NextRequest) {
  const user = await getUserForSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!sessionId) return NextResponse.json({ error: "Missing session" }, { status: 400 });
  const result = await getPool().query<{
    user_id: string | null;
    guest_access_hash: string | null;
    id: string;
    order_number: string | null;
    status: string;
    total_minor: number;
    currency: string;
    event_title: string;
    event_slug: string;
    meta_consent_granted: boolean;
    meta_purchase_event_id: string | null;
  }>(
    `SELECT o.user_id, o.guest_access_hash, o.id, o.order_number, o.status, o.total_minor, o.currency,
            o.meta_consent_granted, o.meta_purchase_event_id, e.title AS event_title, e.slug AS event_slug
       FROM ticket_orders o
       JOIN events e ON e.id = o.event_id
      WHERE o.stripe_checkout_session_id = $1`,
    [sessionId]
  );
  const order = result.rows[0];
  if (order?.user_id && !user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!order || !(user && order.user_id === user.id) && !canAccessGuestOrder(order,request.cookies.get(GUEST_COOKIE)?.value)) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const base = { guest: !order.user_id, id: order.id, order_number: order.order_number, status: order.status, eventSlug: order.event_slug };
  if (order.status !== "paid" || !order.meta_consent_granted || !order.meta_purchase_event_id) {
    return NextResponse.json(base);
  }
  const items = await getPool().query<{
    ticket_type_id: string;
    quantity: number;
    unit_price_minor: number;
  }>(
    "SELECT ticket_type_id, quantity, unit_price_minor FROM ticket_order_items WHERE order_id = $1 ORDER BY id",
    [order.id]
  );
  return NextResponse.json({
    ...base,
    meta: {
      eventId: order.meta_purchase_event_id,
      valueMinor: order.total_minor,
      currency: order.currency,
      contentName: order.event_title,
      contents: items.rows.map((item) => ({
        id: item.ticket_type_id,
        quantity: item.quantity,
        item_price: item.unit_price_minor / 100
      }))
    }
  });
}
