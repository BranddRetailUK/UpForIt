import NyeTickets from "../../../components/NyeTickets";
import { publicTicketSalesOpen } from "../../../lib/event-visibility";
import type { Metadata } from "next";
import CloudinaryImage from "../../../components/CloudinaryImage";
import EventUpdatesBanner from "../../../components/EventUpdatesBanner";
import NyeCountdown from "../../../components/NyeCountdown";
import NyeBannerPreload from "../../../components/NyeBannerPreload";
import { CLOUDINARY_ASSETS, cloudinaryUrl } from "../../../lib/cloudinary";

export const dynamic = "force-dynamic";

const description = "UPFORIT NYE 2026 at McCarthys Sports Bar, Bletchley. 31 December, doors open 5pm. Lineup to be revealed.";

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
  const showTickets = preview || (publicTicketSalesOpen() && process.env.TICKETING_ENABLED === "true");
  return (
    <div className="nye-event">
      <NyeBannerPreload />
      {preview ? <div className="nye-preview-note">LOCAL PREVIEW · Ticket sales are not live</div> : null}
      <section className="nye-hero nye-event__hero" aria-labelledby="nye-title">
        <div className="nye-hero__speakers" aria-hidden="true" />
        <div className="nye-hero__paint" aria-hidden="true" />
        <div className="section-wrap nye-event__layout">
          <div className="nye-event__copy">
            <CloudinaryImage className="nye-hero__brand" asset={CLOUDINARY_ASSETS.nye2026Logo} alt="UPFORIT" maxWidth={1020} sizes="308px" priority />
            <p className="nye-hero__eyebrow">Presents</p>
            <h1 id="nye-title" className="nye-hero__title">
              <CloudinaryImage asset={CLOUDINARY_ASSETS.nye2026Title} alt="NYE 2026" sizes="(max-width: 640px) calc(100vw - 36px), (max-width: 696px) calc(100vw - 96px), (max-width: 800px) 600px, (max-width: 1000px) calc((100vw - 128px) / 2.08), (max-width: 1376px) calc((100vw - 156px) / 2.08), 587px" priority />
            </h1>
            <NyeCountdown />
            <p className="nye-hero__date"><time dateTime="2026-12-31">31 December 2026</time><span aria-hidden="true"> / </span><span>Doors open 5pm</span></p>
            <p className="nye-hero__venue">McCarthys Sports Bar <span>Bletchley</span></p>
            <div className="industrial-actions nye-hero__actions">
              <a className="industrial-button" href={showTickets ? "#tickets" : "#nye-updates"}>{showTickets ? "Get tickets — £10" : "Get event updates"}</a>
            </div>
          </div>
          <figure className="nye-event__teaser">
            <CloudinaryImage asset={CLOUDINARY_ASSETS.nye2026Teaser} alt="UPFORIT NYE 2026 square teaser, with a mystery artist concealed by yellow and black glitch distortion. 31 December." sizes="(max-width: 640px) calc(100vw - 36px), (max-width: 696px) calc(100vw - 96px), (max-width: 800px) 600px, (max-width: 1000px) calc((100vw - 128px) * .51923), (max-width: 1376px) calc((100vw - 156px) * .51923), 634px" priority />
          </figure>
        </div>
      </section>
      <div className="nye-event__strip" aria-hidden="true"><span>31.12.26</span><span>BLETCHLEY</span><span>UPFORIT NYE</span><span>31.12.26</span></div>
      {showTickets ? <section className="section-wrap nye-event__tickets" aria-label="NYE tickets"><div className="nye-ticket-intro"><h2>NYE 2026<br /><em>TICKETS</em></h2><p className="nye-ticket-intro__venue">McCarthys Sports Bar</p><p className="nye-ticket-intro__location">Bletchley</p><p className="nye-ticket-intro__doors">Doors open 5pm</p></div><NyeTickets preview={preview} /></section> : null}
      <EventUpdatesBanner id="nye-updates" />
    </div>
  );
}
