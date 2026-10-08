import { PAST_EVENTS } from "../lib/past-events";
import Link from "next/link";
import CloudinaryImage from "../components/CloudinaryImage";
import { CLOUDINARY_ASSETS } from "../lib/cloudinary";
import SignupForm from "../components/SignupForm";
import PastEventCard from "../components/PastEventCard";
import NyeBannerPreload from "../components/NyeBannerPreload";

export default function Home() {
  return (
    <div className="industrial-home">
      <NyeBannerPreload />
      <section className="nye-hero" aria-labelledby="home-title">
        <div className="nye-hero__speakers" aria-hidden="true" />
        <div className="nye-hero__paint" aria-hidden="true" />
        <div className="nye-hero__content">
          <CloudinaryImage className="nye-hero__brand" asset={CLOUDINARY_ASSETS.nye2026Logo} alt="UPFORIT" maxWidth={1020} sizes="(max-width: 640px) 240px, 340px" priority />
          <p className="nye-hero__eyebrow">Presents</p>
          <h1 id="home-title" className="nye-hero__title">
            <CloudinaryImage asset={CLOUDINARY_ASSETS.nye2026Title} alt="NYE 2026" sizes="(max-width: 640px) 90vw, (max-width: 1143px) 70vw, 800px" priority />
          </h1>
          <p className="nye-hero__date"><time dateTime="2026-12-31">31 December 2026</time><span aria-hidden="true"> / </span><span>Doors open 5pm</span></p>
          <p className="nye-hero__venue">McCarthys Sports Bar <span>Bletchley</span></p>
          <div className="industrial-actions nye-hero__actions">
            <Link className="industrial-button" href="/events/nye-2026">CHECK THE EVENT</Link>
            <Link className="industrial-link" href="/music">Explore the UPFORIT sound</Link>
          </div>
        </div>
      </section>
      <section className="bass-discover section-wrap" aria-label="Explore UPFORIT">
        <Link href="/music" className="discover-card discover-card--music"><h2>TURN IT<br /><em>UP.</em></h2><span className="discover-card__action">Music &amp; mixes </span></Link>
        <Link href="/merch" className="discover-card discover-card--merch"><h2>UP FOR IT<br /><em>CLOTHING.</em></h2><span className="discover-card__action">Shop the collection </span></Link>
      </section>
      <section className="bass-newsletter section-wrap" id="stay-connected" aria-labelledby="signup-heading"><div><h2 id="signup-heading">DON’T MISS<br />THE <em>NEXT ONE.</em></h2></div><div className="bass-newsletter__form"><SignupForm /></div></section>
      <section className="bass-archive section-wrap" aria-labelledby="archive-title"><div className="bass-section-heading"><div><h2 id="archive-title">GOOD TIMES. <em>ON RECORD.</em></h2></div><Link className="industrial-link" href="/events">Event archive </Link></div><div className="past-event-list">{PAST_EVENTS.map(event => <PastEventCard key={event.slug} event={event} />)}</div></section>
    </div>
  );
}
