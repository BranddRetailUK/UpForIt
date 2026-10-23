"use client";

import Link from "next/link";
import { pollConfirmation } from "../lib/confirmation-polling";
import { useEffect, useRef, useState } from "react";
import { useMetaTracking } from "./MetaTrackingProvider";

type Status = {
  guest?: boolean;
  id: string;
  order_number: string | null;
  status: string;
  eventSlug?: string;
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

  const [waiting, setWaiting] = useState(false);
  const [retry, setRetry] = useState(0);
  const [signInRequired, setSignInRequired] = useState(false);

  useEffect(() => {
    setWaiting(false); setError(""); setSignInRequired(false);
    return pollConfirmation<Status>({sessionId,
      waiting:()=>setWaiting(true),signIn:()=>setSignInRequired(true),
      error:()=>setError("We cannot display this order. Check your email or contact support; do not pay again."),
      result:(result)=>{
        setOrder(result);
        try {
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
        } catch { /* Analytics/storage availability must not change payment confirmation. */ }
      }
    });
  }, [consent, sessionId, track, retry]);

  if(signInRequired)return <p>Your session has expired. Please <Link href={`/account/login?next=${encodeURIComponent(`/tickets/confirmation?session_id=${sessionId}`)}`}>sign in to check your order</Link>. Do not pay again.</p>;
  if (error) return <p className="form-message form-message--error">{error}</p>;
  if (!order || order.status === "pending") return <p>{waiting ? "We are still waiting for payment confirmation. Please do not pay again. Refresh this page or check your email shortly." : "Checking your payment and ticket status…"} {order && !order.guest && <Link href="/account">View account</Link>} {waiting && <button onClick={()=>setRetry(value=>value+1)}>Check again</button>}</p>;
  if (order.status === "refund_review") return <p>Payment received. Your order is held for review and tickets are unavailable. Please do not pay again. {order.guest ? <a href="mailto:info@upforitevents.co.uk">Contact support</a> : <Link href={`/account/orders/${order.id}`}>View your order</Link>}</p>;
  if (order.status !== "paid") return <p>Your order status is {order.status}. Please contact us if this looks wrong.</p>;
  if (!order.order_number) return <p>Payment received. We’re issuing your order number now…</p>;
  return (
    <div className="ticket-confirmation">
      <p className="form-message form-message--success ticket-confirmation__message">Your tickets are ready. A confirmation email is on its way.</p>
      {order.eventSlug === "nye-2026" && <p>Fancy a set at NYE? <Link href="/events/nye-2026/blackleys-bucket">Enter Blackley’s Bucket</Link></p>}
      <p className="ticket-confirmation__order">Order <strong>{order.order_number}</strong></p>
      <Link className="pop-button pop-button--yellow ticket-confirmation__action" href={order.guest ? `/api/tickets/orders/${order.id}/pdf` : `/account/orders/${order.id}`}>{order.guest ? "Download tickets" : "View tickets"}</Link>
    </div>
  );
}
