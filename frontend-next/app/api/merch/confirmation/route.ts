import { NextRequest, NextResponse } from "next/server";
import { goodGamePath, goodGameUrl, signMerchRequest } from "../../../../lib/merch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessionId = String(request.nextUrl.searchParams.get("session_id") || "");
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    return NextResponse.json({ error: "Invalid checkout session" }, { status: 400 });
  }
  try {
    const query = `?session_id=${encodeURIComponent(sessionId)}`;
    const path = `${goodGamePath("/checkout-confirmation")}${query}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const response = await fetch(`${goodGameUrl("/checkout-confirmation")}${query}`, {
      headers: {
        "x-storefront-timestamp": timestamp,
        "x-storefront-signature": signMerchRequest({ timestamp, method: "GET", path })
      },
      cache: "no-store"
    });
    const payload = await response.json().catch(() => ({}));
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    console.error("[merch-confirmation]", error);
    return NextResponse.json({ error: "Order confirmation is temporarily unavailable" }, { status: 503 });
  }
}
