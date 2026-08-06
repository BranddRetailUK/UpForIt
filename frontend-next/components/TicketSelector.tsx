"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMetaTracking } from "./MetaTrackingProvider";

type Tier = {
  id: string;
  name: string;
  priceMinor: number;
  maxPerOrder: number;
  remaining: number | null;
  active: boolean;
  status: "on_sale" | "sold_out" | "reserved" | "upcoming";
};

export default function TicketSelector({
  eventId,
  eventTitle,
  tiers,
  signedIn
}: {
  eventId: string;
  eventTitle: string;
  tiers: Tier[];
  signedIn: boolean;
}) {
  const { consent, createEventId, getBrowserContext, track } = useMetaTracking();
  const viewContentTracked = useRef("");
  const [quantities, setQuantities] = useState<Record<string, number>>(() => Object.fromEntries(
    tiers.filter((tier) => tier.active).map((tier) => [tier.id, 1])
  ));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const activeTiers = tiers.filter((tier) => tier.active);
  const total = tiers.reduce((sum, tier) => sum + (quantities[tier.id] ?? 0) * tier.priceMinor, 0);

  useEffect(() => {
    if (consent !== "granted" || viewContentTracked.current === eventId) return;
    track("ViewContent", {
      content_ids: tiers.map((tier) => tier.id),
      content_name: eventTitle,
      content_category: "event tickets",
      content_type: "product"
    });
    viewContentTracked.current = eventId;
  }, [consent, eventId, eventTitle, tiers, track]);

  async function checkout() {
    setBusy(true);
    setError("");
    try {
      const eventID = createEventId("ticket_checkout");
      const selected = activeTiers
        .map((tier) => ({ tier, quantity: quantities[tier.id] ?? 0 }))
        .filter(({ quantity }) => quantity > 0);
      const response = await fetch("/api/tickets/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          items: selected.map(({ tier, quantity }) => ({ ticketTypeId: tier.id, quantity })),
          meta: getBrowserContext(eventID)
        })
      });
      const result = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "Checkout could not be started.");
      track("InitiateCheckout", {
        content_ids: selected.map(({ tier }) => tier.id),
        content_name: eventTitle,
        content_category: "event tickets",
        content_type: "product",
        contents: selected.map(({ tier, quantity }) => ({
          id: tier.id,
          quantity,
          item_price: tier.priceMinor / 100
        })),
        num_items: selected.reduce((sum, item) => sum + item.quantity, 0),
        value: total / 100,
        currency: "GBP"
      }, eventID);
      window.location.assign(result.url);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Checkout could not be started.");
      setBusy(false);
    }
  }

  return (
    <section className="ticket-selector" id="tickets">
      <h2>Tickets</h2>
      <div className="ticket-tier-list">
        {tiers.map((tier) => {
          const maximum = Math.min(tier.maxPerOrder, tier.remaining ?? tier.maxPerOrder);
          const quantity = quantities[tier.id] ?? 0;
          const status = tier.status === "sold_out"
            ? "Sold out"
            : tier.status === "reserved"
              ? "All remaining tickets are currently held"
              : null;
          return (
          <div className={`ticket-tier ticket-tier--${tier.status}${tier.active ? "" : " is-inactive"}${tier.status === "sold_out" ? " is-sold-out" : ""}${tier.status === "upcoming" ? " has-coming-soon" : ""}`} key={tier.id}>
            <span className="ticket-tier__copy">
              <strong className="ticket-tier__name">{tier.name}</strong>
              {status ? <small className="ticket-tier__status">{status}</small> : null}
            </span>
            <strong className="ticket-tier__price">£{(tier.priceMinor / 100).toFixed(2)}</strong>
            {tier.active ? (
              <div className="ticket-tier__quantity" role="group" aria-label={`${tier.name} quantity`}>
                <button
                  type="button"
                  aria-label={`Decrease ${tier.name} quantity`}
                  disabled={busy || quantity === 0}
                  onClick={() => setQuantities((current) => ({
                    ...current,
                    [tier.id]: Math.max(0, (current[tier.id] ?? 1) - 1)
                  }))}
                >
                  ←
                </button>
                <output aria-live="polite" aria-label={`${tier.name} ticket count`}>{quantity}</output>
                <button
                  type="button"
                  aria-label={`Increase ${tier.name} quantity`}
                  disabled={busy || quantity >= maximum}
                  onClick={() => setQuantities((current) => ({
                    ...current,
                    [tier.id]: Math.min(maximum, (current[tier.id] ?? 1) + 1)
                  }))}
                >
                  →
                </button>
              </div>
            ) : null}
            {tier.status === "upcoming" ? <span className="ticket-tier__coming-soon">Coming soon</span> : null}
          </div>
          );
        })}
      </div>
      <div className="ticket-selector__total"><span>Total</span><strong>£{(total / 100).toFixed(2)}</strong></div>
      {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
      <div className="ticket-selector__action">
        {signedIn ? (
          <button className="pop-button pop-button--yellow" type="button" disabled={busy || total === 0} onClick={checkout}>
            {busy ? "Opening checkout…" : "Buy tickets"}
          </button>
        ) : (
          <Link className="pop-button pop-button--yellow" href="/account/login?next=%2Fevents%2Fsummer-roundup-2026%23tickets">Sign in to buy tickets</Link>
        )}
      </div>
      <p className="ticket-selector__support">
        Having trouble? Contact <a href="mailto:info@upforitevents.co.uk">info@upforitevents.co.uk</a> for help.
      </p>
    </section>
  );
}
