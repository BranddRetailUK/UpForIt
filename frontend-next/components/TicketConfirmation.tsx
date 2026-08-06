"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useMetaTracking } from "./MetaTrackingProvider";

type Status = {
  id: string;
  order_number: string;
  status: string;
  meta?: {
    eventId: string;
    valueMinor: number;
    currency: string;
    contentName: string;
    contents: Array<{ id: string; quantity: number; item_price: number }>;
  };
};

export default function TicketConfirmation({ sessionId }: { sessionId: string }) {
  const { consent, track } = useMetaTracking();
  const [order, setOrder] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const trackedEventId = useRef("");

  useLayoutEffect(() => {
    window.history.replaceState({}, "", "/tickets/confirmation");
  }, []);

  useEffect(() => {
    let stopped = false;
    let attempts = 0;
    async function refresh() {
      try {
        const response = await fetch(`/api/tickets/confirmation?session_id=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
        const result = await response.json() as Status & { error?: string };
        if (!response.ok) throw new Error(result.error || "Order not found.");
        if (stopped) return;
        setOrder(result);
        if (result.status === "paid" && result.meta?.eventId && consent === "granted") {
          const storageKey = `upforit.meta.purchase.${result.meta.eventId}`;
          const alreadyTracked = trackedEventId.current === result.meta.eventId || window.localStorage.getItem(storageKey) === "1";
          if (!alreadyTracked) {
            track("Purchase", {
              content_ids: result.meta.contents.map((item) => item.id),
              content_name: result.meta.contentName,
              content_category: "event tickets",
              content_type: "product",
              contents: result.meta.contents,
              num_items: result.meta.contents.reduce((sum, item) => sum + item.quantity, 0),
              value: result.meta.valueMinor / 100,
              currency: result.meta.currency.toUpperCase()
            }, result.meta.eventId);
            trackedEventId.current = result.meta.eventId;
            window.localStorage.setItem(storageKey, "1");
          }
        }
        attempts += 1;
        if (result.status === "pending" && attempts < 15) window.setTimeout(refresh, 2000);
      } catch (refreshError) {
        if (!stopped) setError(refreshError instanceof Error ? refreshError.message : "Order not found.");
      }
    }
    refresh();
    return () => { stopped = true; };
  }, [consent, sessionId, track]);

  if (error) return <p className="form-message form-message--error">{error}</p>;
  if (!order || order.status === "pending") return <p>Payment received. We’re issuing your tickets now…</p>;
  if (order.status !== "paid") return <p>Your order status is {order.status}. Please contact us if this looks wrong.</p>;
  return (
    <div className="ticket-confirmation">
      <p className="form-message form-message--success ticket-confirmation__message">Your tickets are ready. A confirmation email is on its way.</p>
      <p className="ticket-confirmation__order">Order <strong>{order.order_number}</strong></p>
      <Link className="pop-button pop-button--yellow ticket-confirmation__action" href={`/account/orders/${order.id}`}>View tickets</Link>
    </div>
  );
}
