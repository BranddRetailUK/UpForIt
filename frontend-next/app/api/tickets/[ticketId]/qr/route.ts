import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getUserForSessionToken, SESSION_COOKIE } from "../../../../../lib/auth";
import { getPool } from "../../../../../lib/db";
import { createTicketQrToken } from "../../../../../lib/security";

export async function GET(request: NextRequest, { params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  const user = await getUserForSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return new NextResponse("Sign in required", { status: 401 });
  const result = await getPool().query<{ public_id: string; user_id: string }>(
    "SELECT public_id, user_id FROM tickets WHERE id = $1",
    [ticketId]
  );
  const ticket = result.rows[0];
  if (!ticket || (ticket.user_id !== user.id && user.role === "customer")) return new NextResponse("Not found", { status: 404 });
  const image = await QRCode.toBuffer(createTicketQrToken(ticket.public_id), { type: "png", width: 600, margin: 2 });
  return new NextResponse(new Uint8Array(image), {
    headers: { "content-type": "image/png", "cache-control": "private, no-store" }
  });
}
