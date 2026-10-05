import { PAST_EVENTS } from "../lib/past-events";
import Link from "next/link";
import SignupForm from "../components/SignupForm";
import PastEventCard from "../components/PastEventCard";

export default function Home() {
  return (
    <div className="industrial-home">
      <section className="bass-hero" aria-labelledby="home-title">
        <div className="bass-hero__texture" aria-hidden="true" />
        <div className="bass-hero__content section-wrap">

          <h1 id="home-title">GOOD MUSIC.<br />GREAT PEOPLE.<br /><em>UP FOR IT?</em></h1>

          <div className="industrial-actions">
            <a className="industrial-button" href="#stay-connected">Stay in the loop </a>
            <Link className="industrial-link" href="/music">EXPLORE THE UPFORIT SOUND</Link>
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
