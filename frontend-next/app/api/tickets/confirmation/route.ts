import { NextRequest, NextResponse } from "next/server";
import { getUserForSessionToken, SESSION_COOKIE } from "../../../../lib/auth";
import { getPool } from "../../../../lib/db";

export async function GET(request: NextRequest) {
  const user = await getUserForSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!sessionId) return NextResponse.json({ error: "Missing session" }, { status: 400 });
  const result = await getPool().query<{ id: string; order_number: string; status: string }>(
    "SELECT id, order_number, status FROM ticket_orders WHERE stripe_checkout_session_id = $1 AND user_id = $2",
    [sessionId, user.id]
  );
  if (!result.rows[0]) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  return NextResponse.json(result.rows[0]);
}

