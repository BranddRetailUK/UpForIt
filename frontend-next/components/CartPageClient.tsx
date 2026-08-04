"use client";

import { useEffect, useMemo, useState } from "react";
import { CartLines, useCart, type CartLine } from "./CartProvider";

const CHECKOUT_INTENT_STORAGE_KEY = "upforit.merch.checkout-intent.v1";

function getCheckoutIntentKey(lines: CartLine[]) {
  const fingerprint = lines
    .map((line) => `${line.variantId}:${line.quantity}`)
    .sort()
    .join("|");
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(CHECKOUT_INTENT_STORAGE_KEY) || "null");
    if (stored?.fingerprint === fingerprint && /^ufi_[0-9a-f-]{36}$/i.test(String(stored?.key || ""))) {
      return String(stored.key);
    }
  } catch {}
  const key = `ufi_${window.crypto.randomUUID()}`;
  window.sessionStorage.setItem(CHECKOUT_INTENT_STORAGE_KEY, JSON.stringify({ fingerprint, key }));
  return key;
}

export default function CartPageClient({ cancelled = false }: { cancelled?: boolean }) {
  const { lines, replaceLines } = useCart();
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const total = useMemo(() => lines.reduce((sum, line) => sum + line.priceMinor * line.quantity, 0), [lines]);

  useEffect(() => {
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
      const response = await fetch("/api/merch/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
          idempotencyKey: getCheckoutIntentKey(lines)
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload.url) throw new Error(payload.error || "Unable to start checkout");
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
          <div><span>Merch subtotal</span><strong>{new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(total / 100)}</strong></div>
          <div><span>UK delivery</span><strong>Calculated securely</strong></div>
          <p>Stripe will collect your email, UK delivery address, billing address and payment details.</p>
          <button className="pop-button pop-button--pink" type="button" disabled={checking || submitting} onClick={checkout}>
            {checking ? "Checking your cart…" : submitting ? "Opening secure checkout…" : "Secure checkout"}
          </button>
          <small>Payment and fulfilment are handled by Good Game Apparel.</small>
        </aside>
      )}
    </div>
  );
}
