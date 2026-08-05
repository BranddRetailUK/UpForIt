"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Status = { id: string; order_number: string; status: string };

export default function TicketConfirmation({ sessionId }: { sessionId: string }) {
  const [order, setOrder] = useState<Status | null>(null);
  const [error, setError] = useState("");
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
        attempts += 1;
        if (result.status === "pending" && attempts < 15) window.setTimeout(refresh, 2000);
      } catch (refreshError) {
        if (!stopped) setError(refreshError instanceof Error ? refreshError.message : "Order not found.");
      }
    }
    refresh();
    return () => { stopped = true; };
  }, [sessionId]);

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
