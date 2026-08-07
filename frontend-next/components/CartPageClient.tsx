"use client";

import { useEffect, useMemo, useState } from "react";
import { getDisplayedMerchDeliveryMinor } from "../lib/merch-delivery";
import { CartLines, useCart, type CartLine } from "./CartProvider";
import { useMetaTracking } from "./MetaTrackingProvider";

const CHECKOUT_INTENT_STORAGE_KEY = "upforit.merch.checkout-intent.v1";

type TicketMerchDiscount = {
  entitlementId: string;
  percentOff: number;
  status: "available" | "reserved";
};

function getCheckoutIntentKey(lines: CartLine[], discountEntitlementId = "") {
  const fingerprint = lines
    .map((line) => `${line.variantId}:${line.quantity}`)
    .sort()
    .join("|") + `|discount:${discountEntitlementId}`;
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(CHECKOUT_INTENT_STORAGE_KEY) || "null");
    const fresh = Date.now() - Number(stored?.createdAt || 0) < 25 * 60 * 1000;
    if (fresh && stored?.fingerprint === fingerprint && /^ufi_[0-9a-f-]{36}$/i.test(String(stored?.key || ""))) {
      return String(stored.key);
    }
  } catch {}
  const key = `ufi_${window.crypto.randomUUID()}`;
  window.sessionStorage.setItem(CHECKOUT_INTENT_STORAGE_KEY, JSON.stringify({ fingerprint, key, createdAt: Date.now() }));
  return key;
}

export default function CartPageClient({ cancelled = false }: { cancelled?: boolean }) {
  const { lines, replaceLines } = useCart();
  const { createEventId, track } = useMetaTracking();
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [discount, setDiscount] = useState<TicketMerchDiscount | null>(null);
  const total = useMemo(() => lines.reduce((sum, line) => sum + line.priceMinor * line.quantity, 0), [lines]);
  const deliveryMinor = useMemo(() => getDisplayedMerchDeliveryMinor(lines), [lines]);
  const discountMinor = discount ? Math.round(total * discount.percentOff / 100) : 0;
  const discountedSubtotalMinor = Math.max(0, total - discountMinor);
  const finalTotalMinor = discountedSubtotalMinor + deliveryMinor;
  const formatMoney = (valueMinor: number) => new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP"
  }).format(valueMinor / 100);

  useEffect(() => {
    if (cancelled) window.sessionStorage.removeItem(CHECKOUT_INTENT_STORAGE_KEY);
    if (!lines.length) {
      setChecking(false);
      return;
    }
    const controller = new AbortController();
    void fetch("/api/merch/cart", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })) }),
      signal: controller.signal
    }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to refresh cart");
      replaceLines(payload.lines as CartLine[]);
      setDiscount(payload.discount as TicketMerchDiscount | null);
      if (Number(payload.removedCount || 0) > 0) {
        setNotice(`${Number(payload.removedCount)} unavailable cart item${Number(payload.removedCount) === 1 ? " was" : "s were"} removed and prices were refreshed.`);
      }
    }).catch((reason) => {
      if (reason?.name !== "AbortError") setError(reason?.message || "Unable to refresh cart");
    }).finally(() => setChecking(false));
    return () => controller.abort();
  }, []); // The cart is deliberately refreshed once when this checkout page opens.

  async function checkout() {
    if (!lines.length || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const eventId = createEventId("merch_checkout");
      const response = await fetch("/api/merch/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
          idempotencyKey: getCheckoutIntentKey(lines, discount?.entitlementId),
          discountEntitlementId: discount?.entitlementId
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload.url) throw new Error(payload.error || "Unable to start checkout");
      track("InitiateCheckout", {
        content_ids: lines.map((line) => line.variantId),
        content_category: "merch",
        content_type: "product",
        contents: lines.map((line) => ({ id: line.variantId, quantity: line.quantity, item_price: line.priceMinor / 100 })),
        num_items: lines.reduce((sum, line) => sum + line.quantity, 0),
        value: finalTotalMinor / 100,
        currency: "GBP"
      }, eventId);
      window.location.assign(payload.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to start checkout");
      setSubmitting(false);
    }
  }

  return (
    <div className="cart-page-layout">
      <section className="cart-page-lines">
        {cancelled && <div className="cart-alert">Checkout was cancelled. Your cart is still here.</div>}
        {notice && <div className="cart-alert">{notice}</div>}
        {error && <div className="cart-alert is-error">{error}</div>}
        <CartLines />
      </section>
      {lines.length > 0 && (
        <aside className="cart-summary">
          <p className="comic-kicker">Order recap</p>
          {discount && (
            <p className="cart-summary__discount-unlocked" role="status">
              <strong>Ticket perk unlocked!</strong>
              Your one-time 20% merch discount is applied.
            </p>
          )}
          <div><span>Merch subtotal</span><strong>{formatMoney(total)}</strong></div>
          {discount && (
            <div className="cart-summary__discount-row">
              <span>Ticket-holder discount (20%)</span>
              <strong className="cart-summary__discount-value">{formatMoney(-discountMinor)}</strong>
            </div>
          )}
          {discount && <div><span>Discounted merch</span><strong>{formatMoney(discountedSubtotalMinor)}</strong></div>}
          <div><span>UK delivery</span><strong>{formatMoney(deliveryMinor)}</strong></div>
          <div className="cart-summary__total"><span>Total</span><strong>{formatMoney(finalTotalMinor)}</strong></div>
          <button className="pop-button pop-button--pink" type="button" disabled={checking || submitting} onClick={checkout}>
            {checking ? "Checking your cart…" : submitting ? "Opening secure checkout…" : "Secure checkout"}
          </button>
          <small>Payment and fulfilment are handled by Good Game Apparel.</small>
        </aside>
      )}
    </div>
  );
}
