"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Tier = {
  id: string;
  name: string;
  priceMinor: number;
  maxPerOrder: number;
  remaining: number | null;
  available: boolean;
};

export default function AdminSimulatedPurchase({ tiers }: { tiers: Tier[] }) {
  const router = useRouter();
  const availableTiers = tiers.filter((tier) => tier.available);
  const [ticketTypeId, setTicketTypeId] = useState(availableTiers[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<{ id: string; number: string } | null>(null);
  const selectedTier = useMemo(
    () => availableTiers.find((tier) => tier.id === ticketTypeId) ?? availableTiers[0],
    [availableTiers, ticketTypeId]
  );
  const maximum = selectedTier
    ? Math.min(selectedTier.maxPerOrder, selectedTier.remaining ?? selectedTier.maxPerOrder)
    : 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTier) return;
    setBusy(true);
    setError("");
    setOrder(null);
    try {
      const response = await fetch("/api/admin/simulated-purchase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ticketTypeId: selectedTier.id,
          quantity: Math.min(quantity, maximum),
          idempotencyKey: crypto.randomUUID()
        })
      });
      const result = (await response.json()) as { error?: string; orderId?: string; orderNumber?: string };
      if (!response.ok || !result.orderId || !result.orderNumber) {
        throw new Error(result.error || "The simulated purchase could not be completed.");
      }
      setOrder({ id: result.orderId, number: result.orderNumber });
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "The simulated purchase could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-simulated-purchase" onSubmit={submit}>
      <div>
        <h2>Simulate a ticket purchase</h2>
        <p>No Stripe payment is taken. The order, tickets, confirmation email, QR codes and PDF are created exactly like a paid order.</p>
      </div>
      {selectedTier ? (
        <div className="admin-simulated-purchase__controls">
          <label>
            Ticket tier
            <select value={selectedTier.id} onChange={(event) => { setTicketTypeId(event.target.value); setQuantity(1); }}>
              {availableTiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name} — £{(tier.priceMinor / 100).toFixed(2)}</option>)}
            </select>
          </label>
          <label>
            Quantity
            <select value={Math.min(quantity, maximum)} onChange={(event) => setQuantity(Number(event.target.value))}>
              {Array.from({ length: maximum }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <button className="pop-button pop-button--yellow" type="submit" disabled={busy || maximum < 1}>
            {busy ? "Creating tickets…" : "Buy test ticket"}
          </button>
        </div>
      ) : <p className="form-message">No ticket tier is currently available.</p>}
      {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
      {order ? <p className="form-message form-message--success" role="status">Created {order.number}. <Link href={`/account/orders/${order.id}`}>View its QR tickets and PDF</Link>.</p> : null}
    </form>
  );
}

