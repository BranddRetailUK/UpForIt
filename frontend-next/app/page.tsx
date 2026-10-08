import { PAST_EVENTS } from "../lib/past-events";
import Link from "next/link";
import Image from "next/image";
import SignupForm from "../components/SignupForm";
import PastEventCard from "../components/PastEventCard";

export default function Home() {
  return (
    <div className="industrial-home">
      <section className="nye-hero" aria-labelledby="home-title">
        <div className="nye-hero__speakers" aria-hidden="true" />
        <div className="nye-hero__paint" aria-hidden="true" />
        <div className="nye-hero__content">
          <Image className="nye-hero__brand" src="/brand/nye-2026/upforit-logo.png" alt="UPFORIT" width={2172} height={724} sizes="(max-width: 640px) 240px, 340px" />
          <p className="nye-hero__eyebrow">Presents</p>
          <h1 id="home-title" className="nye-hero__title">
            <Image src="/brand/nye-2026/nye-2026.png" alt="NYE 2026" width={2172} height={724} sizes="(max-width: 640px) 90vw, 800px" preload />
          </h1>
          <p className="nye-hero__date"><time dateTime="2026-12-31">31 December 2026</time><span aria-hidden="true"> / </span><span>Doors open 5pm</span></p>
          <p className="nye-hero__venue">McCarthys Sports Bar <span>Bletchley</span></p>
          <p className="nye-hero__entry">£10 on the door</p>
          <div className="industrial-actions nye-hero__actions">
            <a className="industrial-button" href="#stay-connected">Stay in the loop</a>
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
