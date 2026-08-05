"use client";

import Link from "next/link";
import { useState } from "react";

type Tier = {
  id: string;
  name: string;
  priceMinor: number;
  maxPerOrder: number;
  remaining: number | null;
  active: boolean;
  status: "on_sale" | "sold_out" | "reserved" | "upcoming";
};

export default function TicketSelector({ tiers, signedIn }: { tiers: Tier[]; signedIn: boolean }) {
  const [quantities, setQuantities] = useState<Record<string, number>>(() => Object.fromEntries(
    tiers.filter((tier) => tier.active).map((tier) => [tier.id, 1])
  ));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const activeTiers = tiers.filter((tier) => tier.active);
  const total = tiers.reduce((sum, tier) => sum + (quantities[tier.id] ?? 0) * tier.priceMinor, 0);

  async function checkout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/tickets/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          items: activeTiers
            .map((tier) => ({ ticketTypeId: tier.id, quantity: quantities[tier.id] ?? 0 }))
            .filter((item) => item.quantity > 0)
        })
      });
      const result = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "Checkout could not be started.");
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
              : tier.remaining === null
                ? "On sale — unlimited allocation"
                : `On sale — ${tier.remaining} remaining`;
          return (
          <div className={`ticket-tier ticket-tier--${tier.status}${tier.active ? "" : " is-inactive"}${tier.status === "sold_out" ? " is-sold-out" : ""}${tier.status === "upcoming" ? " has-coming-soon" : ""}`} key={tier.id}>
            <span className="ticket-tier__copy">
              <strong className="ticket-tier__name">{tier.name}</strong>
              {tier.status === "upcoming" ? null : <small className="ticket-tier__status">{status}</small>}
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
    </section>
  );
}
