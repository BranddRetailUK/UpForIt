import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getUserForSessionToken, SESSION_COOKIE } from "../../../../lib/auth";
import { goodGamePath, goodGameUrl, signMerchRequest } from "../../../../lib/merch";
import {
  getUsableMerchDiscount,
  markMerchDiscountReserved,
  reconcileMerchDiscountFromConfirmation,
  TICKET_MERCH_DISCOUNT_CAMPAIGN
} from "../../../../lib/merch-discounts";
import {
  MerchCheckoutGuardError,
  buildCheckoutRequestHash,
  getCheckoutRequesterKey,
  reserveCheckoutAttempt
} from "../../../../lib/merch-checkout-guard";
import { assertSameOrigin } from "../../../../lib/request";

export const runtime = "nodejs";

const DEFAULT_CHECKOUT_ORIGIN = "https://www.upforitevents.co.uk";

function checkoutReturnOrigin() {
  const configuredOrigin = String(process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_CHECKOUT_ORIGIN).trim();
  const url = new URL(configuredOrigin);
  const isLocalDevelopment = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !isLocalDevelopment) {
    throw new Error("Checkout return origin must use HTTPS");
  }
  return url.origin;
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    if (process.env.MERCH_CHECKOUT_ENABLED === "false") {
      return NextResponse.json({ error: "Merch checkout is disabled in this environment" }, { status: 503 });
    }
    const input = await request.json();
    const items = Array.isArray(input?.items)
      ? input.items.map((item: { variantId?: unknown; quantity?: unknown }) => ({
          variantId: String(item?.variantId || ""),
          quantity: Math.trunc(Number(item?.quantity || 0))
        }))
      : [];
    if (!items.length || items.some((item: { variantId: string; quantity: number }) => !/^\d+$/.test(item.variantId) || item.quantity < 1 || item.quantity > 20)) {
      return NextResponse.json({ error: "Your cart contains an invalid item" }, { status: 400 });
    }
    const idempotencyKey = String(input?.idempotencyKey || "").trim();
    if (!/^ufi_[0-9a-f-]{36}$/i.test(idempotencyKey)) {
      return NextResponse.json({ error: "A valid checkout intent is required" }, { status: 400 });
    }
    const user = await getUserForSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
    const entitlement = user ? await getUsableMerchDiscount(user.id) : null;
    const requestedEntitlementId = String(input?.discountEntitlementId || "").trim();
    if (requestedEntitlementId && requestedEntitlementId !== entitlement?.id) {
      return NextResponse.json({ error: "This ticket-holder discount is no longer available" }, { status: 409 });
    }
    await reserveCheckoutAttempt({
      idempotencyKey,
      requestHash: buildCheckoutRequestHash(items, entitlement?.id, user?.id),
      requesterKey: getCheckoutRequesterKey(request.headers)
    });
    const origin = checkoutReturnOrigin();
    const body = JSON.stringify({
      items,
      idempotencyKey,
      successUrl: `${origin}/cart/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/cart?checkout=cancelled`,
      ...(user ? {
        customerAccount: {
          accountId: user.id,
          customerEmail: user.email
        }
      } : {}),
      ...(entitlement && user ? {
        discountEntitlement: {
          id: entitlement.id,
          campaign: TICKET_MERCH_DISCOUNT_CAMPAIGN,
          accountId: user.id,
          customerEmail: user.email
        }
      } : {})
    });
    const path = goodGamePath("/checkout-session");
    const timestamp = String(Math.floor(Date.now() / 1000));
    const response = await fetch(goodGameUrl("/checkout-session"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-storefront-timestamp": timestamp,
        "x-storefront-signature": signMerchRequest({ timestamp, method: "POST", path, body })
      },
      body,
      cache: "no-store"
    });
    const payload = await response.json().catch(() => ({}));
    if (
      !response.ok && entitlement?.stripeCheckoutSessionId &&
      payload.code === "discount_redeemed"
    ) {
      await reconcileMerchDiscountFromConfirmation({
        entitlementId: entitlement.id,
        checkoutSessionId: entitlement.stripeCheckoutSessionId,
        paid: true,
        status: "processed"
      });
    }
    if (response.ok && entitlement && user && typeof payload.checkoutSessionId === "string") {
      await markMerchDiscountReserved({
        entitlementId: entitlement.id,
        userId: user.id,
        idempotencyKey,
        checkoutSessionId: payload.checkoutSessionId
      });
    }
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    if (error instanceof MerchCheckoutGuardError) {
      return NextResponse.json(
        { error: error.message },
        {
          status: error.status,
          headers: error.retryAfterSeconds ? { "retry-after": String(error.retryAfterSeconds) } : undefined
        }
      );
    }
    console.error("[merch-checkout]", error);
    return NextResponse.json({ error: "Secure checkout is temporarily unavailable" }, { status: 503 });
  }
}
