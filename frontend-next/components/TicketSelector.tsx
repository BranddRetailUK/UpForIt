"use client";

import Link from "next/link";
import { ticketPrice, ticketPriceLines } from "../lib/ticket-pricing";
import { useEffect, useRef, useState } from "react";
import { useMetaTracking } from "./MetaTrackingProvider";
import TicketLaunchCountdown from "./TicketLaunchCountdown";
import TicketMerchPromoBanner from "./TicketMerchPromoBanner";

type Tier = {
  id: string;
  name: string;
  priceMinor: number;
  maxPerOrder: number;
  remaining: number | null;
  active: boolean;
  status: "on_sale" | "sold_out" | "upcoming";
};

export default function TicketSelector({
  eventId,
  eventTitle,
  tiers,
  signedIn,
  eventSlug,
  preview = false
}: {
  eventId: string;
  eventTitle: string;
  tiers: Tier[];
  signedIn: boolean;
  eventSlug: string;
  preview?: boolean;
}) {
  const { consent, createEventId, getBrowserContext, track } = useMetaTracking();
  const viewContentTracked = useRef("");
  const [quantities, setQuantities] = useState<Record<string, number>>(() => Object.fromEntries(
    tiers.filter((tier) => tier.active).map((tier) => [tier.id, 1])
  ));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showAccountPrompt, setShowAccountPrompt] = useState(false);
  const accountPromptRef = useRef<HTMLDivElement>(null);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const activeTiers = tiers.filter((tier) => tier.active);
  const prices = activeTiers.map(tier => ticketPrice(eventSlug, tier.priceMinor, quantities[tier.id] ?? 0));
  const total = prices.reduce((sum, price) => sum + price.totalMinor, 0);

  useEffect(() => {
    if (preview || consent !== "granted" || viewContentTracked.current === eventId) return;
    track("ViewContent", {
      content_ids: tiers.map((tier) => tier.id),
      content_name: eventTitle,
      content_category: "event tickets",
      content_type: "product"
    });
    viewContentTracked.current = eventId;
  }, [consent, eventId, eventTitle, tiers, track, preview]);

  const checkoutInFlight = useRef(false);
  const checkoutKey = useRef<{selection: string; key: string} | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(`tickets:${eventId}`) || "null");
      if (saved?.quantities) setQuantities(Object.fromEntries(tiers.filter(t => t.active).map(t => [t.id, Math.max(0, Math.min(t.maxPerOrder, t.remaining ?? t.maxPerOrder, Number(saved.quantities[t.id]) || 0))])));
      if (saved?.checkoutKey) checkoutKey.current = saved.checkoutKey;
    } catch {}
  }, [eventId]);
  useEffect(() => {
    try { sessionStorage.setItem(`tickets:${eventId}`, JSON.stringify({quantities, checkoutKey: checkoutKey.current})); } catch {}
  }, [quantities, eventId]);

  async function checkout() {
    if (!signedIn) {
      setShowAccountPrompt(true);
      requestAnimationFrame(() => accountPromptRef.current?.focus());
      return;
    }
    if (preview) { setError("Ticket checkout is not open yet. Please check back when tickets go live."); return; }
    if (checkoutInFlight.current) return;
    checkoutInFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const eventID = createEventId("ticket_checkout");
      const selected = activeTiers
        .map((tier) => ({ tier, quantity: quantities[tier.id] ?? 0 }))
        .filter(({ quantity }) => quantity > 0);
      const selection = JSON.stringify(selected.map(({tier, quantity}) => [tier.id, quantity]));
      if (checkoutKey.current?.selection !== selection) checkoutKey.current = {selection, key: crypto.randomUUID()};
      try { sessionStorage.setItem(`tickets:${eventId}`, JSON.stringify({quantities, checkoutKey: checkoutKey.current})); } catch {}
      const response = await fetch("/api/tickets/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: checkoutKey.current.key,
          items: selected.map(({ tier, quantity }) => ({ ticketTypeId: tier.id, quantity })),
          meta: getBrowserContext(eventID)
        })
      });
      const result = (await response.json()) as { url?: string; error?: string; verificationRequired?:boolean };
      setVerificationRequired(Boolean(result.verificationRequired));
      if (!response.ok || !result.url) throw new Error(result.error || "Checkout could not be started.");
      track("InitiateCheckout", {
        content_ids: selected.map(({ tier }) => tier.id),
        content_name: eventTitle,
        content_category: "event tickets",
        content_type: "product",
        contents: selected.flatMap(({ tier, quantity }) => ticketPriceLines(eventSlug, tier.name, tier.priceMinor, quantity).map(line => ({
          id: tier.id,
          quantity: line.quantity,
          item_price: line.unitPriceMinor / 100
        }))),
        num_items: selected.reduce((sum, item) => sum + item.quantity, 0),
        value: total / 100,
        currency: "GBP"
      }, eventID);
      window.location.assign(result.url);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Checkout could not be started.");
      setBusy(false);
      checkoutInFlight.current = false;
    }
  }

  return (
    <section className="ticket-selector" id="tickets" aria-label="Select tickets">
      {eventSlug !== "nye-2026" ? <h2>Tickets</h2> : null}
      {eventSlug === "nye-2026" ? <div className="nye-ticket-offer"><strong>BUY 3 TICKETS.<br />GET THE 4TH FREE.</strong></div> : <TicketMerchPromoBanner compact />}
      <div className="ticket-tier-list">
        {tiers.map((tier) => {
          const maximum = Math.min(tier.maxPerOrder, tier.remaining ?? tier.maxPerOrder);
          const quantity = quantities[tier.id] ?? 0;
          const status = tier.status === "sold_out"
            ? "Sold out"
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
                  −
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
                  +
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
      {verificationRequired ? <button disabled={busy} onClick={async()=>{setBusy(true);try{const response=await fetch('/api/auth/resend-verification',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({next:`/events/${eventSlug}#tickets`})});const result=await response.json();setError(response.ok?'Verification email queued. Check your inbox.':result.error);}finally{setBusy(false);}}}>Resend verification email</button> : null}
      <div className="ticket-selector__action">
        <button className="pop-button pop-button--yellow" type="button" disabled={busy || total === 0} onClick={checkout}>
          {preview && eventSlug === "nye-2026" ? <TicketLaunchCountdown /> : preview ? "Checkout opens when tickets go live" : busy ? "Opening checkout…" : "Buy tickets"}
        </button>
      </div>
      {showAccountPrompt && <div className="ticket-account-prompt" ref={accountPromptRef} tabIndex={-1} role="region" aria-labelledby="ticket-account-title">
        <h3 id="ticket-account-title">CREATE YOUR ACCOUNT</h3>
        <p>{preview ? "Sign up now so you’re ready when tickets go live." : "Create an account to buy tickets and keep them all in one place."}</p>
        <Link className="industrial-button" href={`/account/signup?next=${encodeURIComponent(`/events/${eventSlug}#tickets`)}`}>SIGN UP</Link>
        <p>Already have an account? <Link href={`/account/login?next=${encodeURIComponent(`/events/${eventSlug}#tickets`)}`}>Sign in</Link></p>
      </div>}
      <p className="ticket-selector__support">
        Having trouble? Contact <a href="mailto:info@upforitevents.co.uk">info@upforitevents.co.uk</a> for help.
      </p>
    </section>
  );
}
