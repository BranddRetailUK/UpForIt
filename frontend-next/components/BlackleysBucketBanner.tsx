import Image from "next/image";
import Link from "next/link";

export default function BlackleysBucketBanner({ titleId = "bucket-banner-title" }: { titleId?: string }) {
  return (
      <section className="home-bucket section-wrap" aria-labelledby={titleId}>
        <div className="home-bucket__content">
          <h2 id={titleId} className="home-bucket__title">
            <span className="home-bucket__logos">
              <span className="home-bucket__cre8" aria-hidden="true" />
              <Image src="/brand/nye-2026/blackley-logo.png" alt="Blackley’s" width={2835} height={587} sizes="(max-width: 720px) 80vw, 500px" />
              <span className="home-bucket__cre8 home-bucket__cre8--right" aria-hidden="true" />
            </span>
            <Image className="home-bucket__wordmark" src="/brand/blackleys-bucket/bucket-wordmark.png" alt="Bucket" width={2172} height={724} sizes="(max-width: 720px) 230px, 330px" />
          </h2>
          <p className="home-bucket__tagline">Your chance to play at NYE <em>2026</em></p>
          <ul className="home-bucket__stats" aria-label="DJ draw details">
            <li><strong>8</strong> DJs</li>
            <li><strong>15</strong> minutes</li>
            <li><strong>Live</strong> draw</li>
          </ul>
          <Link className="industrial-button" href="/events/nye-2026/blackleys-bucket">Find out more &amp; enter</Link>
        </div>
        <div className="home-bucket__strip">
          <time dateTime="2026-12-31">31 Dec 2026</time>
          <span>McCarthys, Bletchley</span>
          <span>Doors open 5pm</span>
        </div>
      </section>
  );
}
