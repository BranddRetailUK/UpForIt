import Link from "next/link";
import type { CSSProperties } from "react";
import { CLOUDINARY_ASSETS, cloudinaryUrl } from "../lib/cloudinary";
import CloudinaryImage from "./CloudinaryImage";

export default function SummerRoundupCard({
  priority = false,
  flyerBackground = false
}: {
  priority?: boolean;
  flyerBackground?: boolean;
}) {
  const flyerBackgroundStyle = flyerBackground
    ? {
        "--event-card-flyer-background": `url("${cloudinaryUrl(CLOUDINARY_ASSETS.summerRoundupBackground, { width: 1400 })}")`
      } as CSSProperties
    : undefined;

  return (
    <article
      className={`event-card${flyerBackground ? " event-card--flyer" : ""}`}
      style={flyerBackgroundStyle}
    >
      <div className="event-card__burst" aria-hidden="true" />
      {flyerBackground ? (
        <div className="event-card__flyer-hero">
          <CloudinaryImage
            asset={CLOUDINARY_ASSETS.summerRoundupCloud}
            alt=""
            className="event-card__flyer-sticker event-card__flyer-sticker--cloud"
            sizes="(max-width: 720px) 78px, 130px"
            maxWidth={329}
          />
          <div className="event-card__flyer-lockup">
            <CloudinaryImage
              asset={CLOUDINARY_ASSETS.summerRoundupPresents}
              alt="UPFORIT presents"
              className="event-card__flyer-presents"
              sizes="(max-width: 720px) 70vw, 420px"
              maxWidth={840}
              priority={priority}
            />
            <h2 className="event-card__flyer-title">
              <CloudinaryImage
                asset={CLOUDINARY_ASSETS.summerRoundupTitle}
                alt="The Summer Roundup"
                className="event-card__flyer-wordmark"
                sizes="(max-width: 720px) 92vw, 760px"
                maxWidth={1476}
                priority={priority}
              />
            </h2>
          </div>
          <CloudinaryImage
            asset={CLOUDINARY_ASSETS.summerRoundupLightning}
            alt=""
            className="event-card__flyer-sticker event-card__flyer-sticker--lightning"
            sizes="(max-width: 720px) 55px, 90px"
            maxWidth={250}
          />
        </div>
      ) : (
        <>
          <p className="event-card__eyebrow">UPFORIT presents</p>
          <h2 className="event-card__title">
            <CloudinaryImage
              asset={CLOUDINARY_ASSETS.summerRoundup}
              alt="The Summer Roundup"
              className="event-card__wordmark"
              sizes="(max-width: 720px) 86vw, 760px"
              maxWidth={1476}
              priority={priority}
            />
          </h2>
        </>
      )}

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
        Early bird tickets now available!
        <span aria-hidden="true">★</span>
      </div>
      <Link className="pop-button pop-button--yellow" href="/events/summer-roundup-2026">
        Buy tickets
      </Link>
    </article>
  );
}
