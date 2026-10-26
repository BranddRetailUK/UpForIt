import NyeBlackleyBanner from "../../../components/NyeBlackleyBanner";
import BlackleysBucketBanner from "../../../components/BlackleysBucketBanner";
import NyeTickets from "../../../components/NyeTickets";
import { publicTicketSalesOpen } from "../../../lib/event-visibility";
import type { Metadata } from "next";
import EventUpdatesBanner from "../../../components/EventUpdatesBanner";
import { CLOUDINARY_ASSETS, cloudinaryUrl } from "../../../lib/cloudinary";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const description = "2 rooms of underground sounds with Blackley at midnight. UPFORIT NYE 2026, 31 December at McCarthys Sports Bar, Bletchley. Doors 5pm. Tickets £10; four for £30.";

function ArtistList({ names, compact = false }: { names: string[]; compact?: boolean }) {
  return <ul className={`${styles.artists}${compact ? ` ${styles.mcs}` : ""}`}>{names.map(name => <li key={name}>{name}</li>)}</ul>;
}

export const metadata: Metadata = {
  title: "NYE 2026 — 31 December",
  description,
  alternates: { canonical: "/events/nye-2026" },
  openGraph: {
    title: "UPFORIT presents NYE 2026",
    description,
    url: "/events/nye-2026",
    images: [{ url: cloudinaryUrl(CLOUDINARY_ASSETS.nye2026Teaser, { width: 1500 }), width: 1500, height: 1500, alt: "UPFORIT NYE 2026 teaser" }]
  },
  twitter: { card: "summary_large_image", title: "UPFORIT presents NYE 2026", description, images: [cloudinaryUrl(CLOUDINARY_ASSETS.nye2026Teaser, { width: 1500 })] }
};

export default async function NyeEventPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const preview = process.env.NODE_ENV === "development" && (await searchParams).preview === "tickets";
  const salesOpen = publicTicketSalesOpen() && process.env.TICKETING_ENABLED === "true";
  return (
    <div className={`nye-event ${styles.event}`}>
      {preview ? <div className="nye-preview-note">LOCAL PREVIEW · Checkout disabled</div> : null}
      <NyeBlackleyBanner titleId="nye-title" headingLevel="h1" priority showVenue={false} />
      <section className={`section-wrap nye-event__tickets ${styles.tickets}`} aria-label="NYE tickets">
        <div className={`nye-ticket-intro ${styles.intro}`}>
          <h2><span className={styles.presenter}>UPFORIT Presents</span>NYE2026<br /><em>TICKETS</em></h2>
          <p className={styles.summary}>2 rooms of underground sounds.<br /><strong>Blackley taking us into 2027 at midnight.</strong></p>
          <p className="nye-ticket-intro__venue">McCarthys Sports Bar</p>
          <p className="nye-ticket-intro__location">4 Chandos Place<br />Bletchley, Milton Keynes, MK2 2SN</p>
          <p className="nye-ticket-intro__doors"><time dateTime="2026-12-31">31 December 2026</time> · 5pm–2am</p>
        </div>
        <NyeTickets preview={preview || !salesOpen} />
        <div className={styles.more}>
          <details className={styles.lineup} open>
            <summary><span>Explore the line-up</span><span className={styles.toggle} aria-hidden="true" /></summary>
            <div className={styles.rooms}>
              <div>
                <h3>Main room</h3>
                <p className={styles.headliner}>BLACKLEY <span>Midnight set</span></p>
                <ArtistList names={["Garon T b2b Danny Darko", "Spektral", "Misty", "Locked in Chaos", "Sinik", "Deechase", "Jake Hypastep"]} />
                <h4>MCs</h4>
                <ArtistList compact names={["Big G", "E Dappa", "Treble", "Ashman", "Danzee", "Razor"]} />
              </div>
              <div>
                <h3>Room 2 · The Balcony</h3>
                <ArtistList names={["Scott Charles", "Ben Miszty", "Slumberjack", "Diatribe showcase"]} />
              </div>
            </div>
          </details>
          <a className={styles.facebook} href="https://www.facebook.com/events/2196247674321387/" target="_blank" rel="noopener noreferrer">View Facebook event</a>
        </div>
      </section>
      <BlackleysBucketBanner titleId="bucket-promo-title" />
      <EventUpdatesBanner id="nye-updates" />
    </div>
  );
}
