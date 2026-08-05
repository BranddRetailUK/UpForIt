import type { Metadata } from "next";
import Link from "next/link";
import CloudinaryImage from "../../components/CloudinaryImage";
import { CLOUDINARY_ASSETS } from "../../lib/cloudinary";

export const metadata: Metadata = {
  title: "Events",
  description:
    "The Summer Roundup lands at McCarthys Sports Bar on 26 September 2026, noon until 11PM.",
  alternates: { canonical: "/events" }
};

export default function EventsPage() {
  return (
    <div className="inner-page section-wrap">
      <header className="page-intro">
        <p className="comic-kicker comic-kicker--yellow">Save the date</p>
        <h1>Events</h1>
      </header>

      <article className="event-card">
        <div className="event-card__burst" aria-hidden="true" />
        <p className="event-card__eyebrow">UPFORIT presents</p>
        <h2 className="event-card__title">
          <CloudinaryImage
            asset={CLOUDINARY_ASSETS.summerRoundup}
            alt="The Summer Roundup"
            className="event-card__wordmark"
            sizes="(max-width: 720px) 86vw, 760px"
            maxWidth={1476}
            priority
          />
        </h2>

        <div className="event-facts">
          <div className="event-fact event-fact--yellow">
            <span className="event-fact__icon" aria-hidden="true">26</span>
            <div>
              <span className="event-fact__label">Date</span>
              <time dateTime="2026-09-26">26 September 2026</time>
            </div>
          </div>
          <div className="event-fact event-fact--pink">
            <span className="event-fact__icon" aria-hidden="true">12</span>
            <div>
              <span className="event-fact__label">Time</span>
              <time dateTime="2026-09-26T12:00:00+01:00">Noon–11PM</time>
            </div>
          </div>
          <div className="event-fact event-fact--blue">
            <span className="event-fact__icon event-fact__icon--pin" aria-hidden="true">●</span>
            <div>
              <span className="event-fact__label">Venue</span>
              <span>McCarthys Sports Bar</span>
            </div>
          </div>
        </div>

        <div className="coming-soon-strip">
          <span aria-hidden="true">★</span>
          Tickets from £5 — on sale now
          <span aria-hidden="true">★</span>
        </div>
        <Link className="pop-button pop-button--yellow" href="/events/summer-roundup-2026#tickets">
          Buy tickets
        </Link>
      </article>
    </div>
  );
}
