import { PAST_EVENTS } from "../../lib/past-events";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import PastEventCard from "../../components/PastEventCard";
import CloudinaryImage from "../../components/CloudinaryImage";
import { CLOUDINARY_ASSETS } from "../../lib/cloudinary";
export const metadata: Metadata = { title: "Events", description: "Explore upcoming UPFORIT events, including NYE 2026 in Bletchley, and our past event archive.", alternates: { canonical: "/events" } };
export default function EventsPage() {
 return (
  <div className="section-wrap bass-events">
   <header>
    <h1>SEE YOU ON<br />THE <em>DANCEFLOOR.</em></h1>
    <p>Stay in the loop for future event announcements.</p>
    <Link className="industrial-button" href="/#stay-connected">Get event updates</Link>
   </header>
   <section aria-labelledby="upcoming-events">
    <div className="bass-section-heading"><h2 id="upcoming-events">UP <em>NEXT.</em></h2></div>
    <article className="nye-hero nye-list-banner" aria-labelledby="nye-list-title">
     <div className="nye-hero__speakers" aria-hidden="true" />
     <div className="nye-hero__paint" aria-hidden="true" />
     <div className="nye-list-banner__content">
      <p className="nye-list-banner__label">UPCOMING EVENT / 31.12.26</p>
      <CloudinaryImage className="nye-hero__brand" asset={CLOUDINARY_ASSETS.nye2026Logo} alt="UPFORIT" sizes="240px" maxWidth={720} />
      <p className="nye-hero__eyebrow">Presents</p>
      <h3 id="nye-list-title" className="nye-hero__title"><CloudinaryImage asset={CLOUDINARY_ASSETS.nye2026Title} alt="NYE 2026" sizes="(max-width: 700px) 80vw, 500px" /></h3>
      <p className="nye-hero__date"><time dateTime="2026-12-31">31 December 2026</time><span aria-hidden="true"> / </span><span>Doors open 5pm</span></p>
      <p className="nye-hero__venue">McCarthys Sports Bar <span>Bletchley</span></p>
      <p className="nye-hero__entry">£10 on the door</p>
      <div className="industrial-actions nye-hero__actions"><Link className="industrial-button" href="/events/nye-2026">Check the event</Link></div>
     </div>
     <Link className="nye-list-banner__art" href="/events/nye-2026" aria-label="View NYE 2026 event"><Image src="/brand/nye-2026/teaser.png" alt="UPFORIT NYE 2026 teaser" width={1500} height={1500} sizes="(max-width: 700px) 80vw, 420px" /></Link>
    </article>
   </section>
   <section aria-labelledby="past-events">
    <div className="bass-section-heading"><h2 id="past-events">THE <em>ARCHIVE.</em></h2></div>
    <div className="past-event-list">{PAST_EVENTS.map(event => <PastEventCard key={event.slug} event={event} />)}</div>
   </section>
  </div>
 );
}
