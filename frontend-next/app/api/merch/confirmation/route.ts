import { NextRequest, NextResponse } from "next/server";
import { getMerchCheckoutConfirmation } from "../../../../lib/merch";
import { reconcileMerchDiscountFromConfirmation } from "../../../../lib/merch-discounts";
import { getMetaRequestContext, metaEventId, metaSiteUrl, sendMetaConversion } from "../../../../lib/meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessionId = String(request.nextUrl.searchParams.get("session_id") || "");
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    return NextResponse.json({ error: "Invalid checkout session" }, { status: 400 });
  }
  try {
    const { response, payload } = await getMerchCheckoutConfirmation(sessionId);
    if (!response.ok || payload.paid !== true) {
      if (response.ok) {
        await reconcileMerchDiscountFromConfirmation({
          entitlementId: typeof payload.discountEntitlementId === "string" ? payload.discountEntitlementId : null,
          checkoutSessionId: sessionId,
          paid: false,
          status: String(payload.status || "")
        });
      }
      return NextResponse.json(payload, { status: response.status });
    }

    await reconcileMerchDiscountFromConfirmation({
      entitlementId: typeof payload.discountEntitlementId === "string" ? payload.discountEntitlementId : null,
      checkoutSessionId: sessionId,
      paid: true,
      status: String(payload.status || "")
    });

    const valueMinor = Math.max(0, Math.trunc(Number(payload.totalMinor || 0)));
    const currency = typeof payload.currency === "string" && /^[a-z]{3}$/i.test(payload.currency)
      ? payload.currency.toUpperCase()
      : "GBP";
    const eventId = metaEventId("merch_purchase", sessionId);
    const metaContext = getMetaRequestContext(request, undefined);
    if (metaContext.consent) {
      await sendMetaConversion({
        eventName: "Purchase",
        eventId,
        eventSourceUrl: metaSiteUrl("/cart/confirmation"),
        valueMinor,
        currency,
        contentCategory: "merch",
        userData: {
          fbp: metaContext.fbp,
          fbc: metaContext.fbc,
          clientIp: metaContext.clientIp,
          clientUserAgent: metaContext.clientUserAgent
        }
      });
    }
    return NextResponse.json({
      ...payload,
      meta: { eventId, valueMinor, currency }
    }, { status: response.status });
  } catch (error) {
    console.error("[merch-confirmation]", error);
    return NextResponse.json({ error: "Order confirmation is temporarily unavailable" }, { status: 503 });
  }
}
