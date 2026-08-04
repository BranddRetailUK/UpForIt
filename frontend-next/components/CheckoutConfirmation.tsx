"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "./CartProvider";

type Confirmation = {
  paid: boolean;
  status: string;
  orderNumber?: string | null;
  totalMinor?: number;
};

export default function CheckoutConfirmation({ sessionId }: { sessionId: string }) {
  const { clearCart } = useCart();
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const load = async () => {
      try {
        const response = await fetch(`/api/merch/confirmation?session_id=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Unable to confirm order");
        if (!active) return;
        setConfirmation(payload);
        if (payload.paid) {
          clearCart();
          return;
        }
        attempt += 1;
        if (attempt < 20) timer = setTimeout(load, 1500);
        else setError("Payment was received but the order is still being prepared. Your confirmation email will follow shortly.");
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to confirm order");
      }
    };
    void load();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [clearCart, sessionId]);

  return (
    <section className="confirmation-card">
      <div className="confirmation-card__burst" aria-hidden="true">YES!</div>
      {confirmation?.paid ? (
        <>
          <p className="comic-kicker comic-kicker--pink">Payment complete</p>
          <h1>Order confirmed</h1>
          <p>Your order number is <strong>{confirmation.orderNumber}</strong>.</p>
          <p>We’ll email you now and again when Good Game Apparel ships your order.</p>
          <Link className="pop-button pop-button--pink" href="/merch">Back to merch</Link>
        </>
      ) : (
        <>
          <p className="comic-kicker comic-kicker--pink">Hold tight</p>
          <h1>Confirming your order</h1>
          <p>{error || "Stripe has sent you back safely. We’re assigning your UFI order number now…"}</p>
          {error && <Link className="pop-button pop-button--pink" href="/contact">Contact UPFORIT</Link>}
        </>
      )}
    </section>
  );
}
