import Link from "next/link";

export default function TicketMerchPromoBanner({ compact = false, link = false }: { compact?: boolean; link?: boolean }) {
  return (
    <aside className={`ticket-merch-promo ticket-merch-promo--current${compact ? " is-compact" : ""}`} aria-label="Ticket-holder merch offer">
      <div className="ticket-merch-promo__copy">
        <strong>20% off merchandise</strong>
        <small>Included with an UPFORIT ticket purchase.</small>
      </div>
      {link ? <Link className="industrial-button" href="/events/nye-2026#tickets">View tickets</Link> : null}
    </aside>
  );
}
