import NyeBlackleyBanner from "../../../components/NyeBlackleyBanner";
import BlackleysBucketBanner from "../../../components/BlackleysBucketBanner";
import NyeTickets from "../../../components/NyeTickets";
import { publicTicketSalesOpen } from "../../../lib/event-visibility";
import type { Metadata } from "next";
import EventUpdatesBanner from "../../../components/EventUpdatesBanner";
import { CLOUDINARY_ASSETS, cloudinaryUrl } from "../../../lib/cloudinary";

export const dynamic = "force-dynamic";

const description = "UPFORIT NYE 2026 at McCarthys Sports Bar, Bletchley. 31 December, doors open 5pm. Featuring Blackley.";

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
  const showTickets = true;
  return (
    <div className="nye-event">
      {preview ? <div className="nye-preview-note">LOCAL PREVIEW · Ticket sales are not live</div> : null}
      <NyeBlackleyBanner titleId="nye-title" headingLevel="h1" priority />
      {showTickets ? <section className="section-wrap nye-event__tickets" aria-label="NYE tickets"><div className="nye-ticket-intro"><h2>NYE 2026<br /><em>TICKETS</em></h2><p className="nye-ticket-intro__venue">McCarthys Sports Bar</p><p className="nye-ticket-intro__location">4 Chandos Place<br />Bletchley, Milton Keynes, MK2 2SN</p><p className="nye-ticket-intro__doors">Doors open 5pm</p></div><NyeTickets preview={preview || !salesOpen} /></section> : null}
      <BlackleysBucketBanner titleId="bucket-promo-title" />
      <EventUpdatesBanner id="nye-updates" />
    </div>
  );
}
