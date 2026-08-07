import Link from "next/link";
import { CLOUDINARY_ASSETS } from "../lib/cloudinary";
import CloudinaryImage from "./CloudinaryImage";

export default function TicketMerchPromoBanner({
  compact = false,
  link = false
}: {
  compact?: boolean;
  link?: boolean;
}) {
  return (
    <aside className={`ticket-merch-promo${compact ? " is-compact" : ""}`} aria-label="Ticket-holder merch offer">
      <span className="ticket-merch-promo__smiley" aria-hidden="true">
        <CloudinaryImage
          asset={CLOUDINARY_ASSETS.smiley}
          alt=""
          className="ticket-merch-promo__smiley-image"
          sizes="(max-width: 720px) 62px, 132px"
          maxWidth={160}
        />
      </span>
      <div className="ticket-merch-promo__copy">
        <span className="ticket-merch-promo__kicker">Ticket perk!</span>
        <strong>20% off all merch!</strong>
        <small>when you buy a ticket to any UpForIt Event.</small>
      </div>
      {link && (
        <Link className="pop-button pop-button--yellow" href="/events/summer-roundup-2026#tickets">
          Get tickets
        </Link>
      )}
    </aside>
  );
}
