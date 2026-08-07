import Link from "next/link";

export default function TicketMerchPromoBanner({
  compact = false,
  link = false
}: {
  compact?: boolean;
  link?: boolean;
}) {
  return (
    <aside className={`ticket-merch-promo${compact ? " is-compact" : ""}`} aria-label="Ticket-holder merch offer">
      <span className="ticket-merch-promo__burst" aria-hidden="true">20%</span>
      <div className="ticket-merch-promo__copy">
        <span className="ticket-merch-promo__kicker">Ticket perk!</span>
        <strong>20% off all merch with any ticket purchase</strong>
        <small>One merch order per account. Delivery excluded.</small>
      </div>
      {link && (
        <Link className="pop-button pop-button--yellow" href="/events/summer-roundup-2026#tickets">
          Get tickets
        </Link>
      )}
    </aside>
  );
}
