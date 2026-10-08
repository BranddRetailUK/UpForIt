import type { Metadata } from "next";
import Image from "next/image";
import CloudinaryImage from "../../../components/CloudinaryImage";
import SignupForm from "../../../components/SignupForm";
import NyeCountdown from "../../../components/NyeCountdown";
import { CLOUDINARY_ASSETS } from "../../../lib/cloudinary";

const description = "See out 2026 with UPFORIT at McCarthys Sports Bar, Bletchley. 31 December, doors open 5pm. £10 on the door. Lineup to be revealed.";

export const metadata: Metadata = {
  title: "NYE 2026 — 31 December",
  description,
  alternates: { canonical: "/events/nye-2026" },
  openGraph: {
    title: "UPFORIT presents NYE 2026",
    description,
    url: "/events/nye-2026",
    images: [{ url: "/brand/nye-2026/teaser.png", width: 1500, height: 1500, alt: "UPFORIT NYE 2026 teaser" }]
  },
  twitter: { card: "summary_large_image", title: "UPFORIT presents NYE 2026", description, images: ["/brand/nye-2026/teaser.png"] }
};

export default function NyeEventPage() {
  return (
    <div className="nye-event">
      <section className="nye-hero nye-event__hero" aria-labelledby="nye-title">
        <div className="nye-hero__speakers" aria-hidden="true" />
        <div className="nye-hero__paint" aria-hidden="true" />
        <div className="section-wrap nye-event__layout">
          <div className="nye-event__copy">
            <CloudinaryImage className="nye-hero__brand" asset={CLOUDINARY_ASSETS.nye2026Logo} alt="UPFORIT" maxWidth={1020} sizes="(max-width: 640px) 240px, 340px" priority />
            <p className="nye-hero__eyebrow">Presents</p>
            <h1 id="nye-title" className="nye-hero__title">
              <CloudinaryImage asset={CLOUDINARY_ASSETS.nye2026Title} alt="NYE 2026" sizes="(max-width: 800px) 90vw, 540px" priority />
            </h1>
            <NyeCountdown />
            <p className="nye-hero__date"><time dateTime="2026-12-31">31 December 2026</time><span aria-hidden="true"> / </span><span>Doors open 5pm</span></p>
            <p className="nye-hero__venue">McCarthys Sports Bar <span>Bletchley</span></p>
            <p className="nye-hero__entry">£10 on the door</p>
            <div className="industrial-actions nye-hero__actions">
              <a className="industrial-button" href="#nye-updates">Get event updates</a>
            </div>
          </div>
          <figure className="nye-event__teaser">
            <Image src="/brand/nye-2026/teaser.png" alt="UPFORIT NYE 2026 square teaser, with a mystery artist concealed by yellow and black glitch distortion. 31 December." width={1500} height={1500} sizes="(max-width: 800px) 90vw, (max-width: 1400px) 46vw, 620px" preload />
          </figure>
        </div>
      </section>
      <div className="nye-event__strip" aria-hidden="true"><span>31.12.26</span><span>BLETCHLEY</span><span>UPFORIT NYE</span><span>31.12.26</span></div>
      <section className="bass-newsletter section-wrap nye-event__updates" id="nye-updates" aria-labelledby="nye-updates-title">
        <div>
          <h2 id="nye-updates-title">STAY IN<br /><em>THE LOOP.</em></h2>
        </div>
        <div className="bass-newsletter__form">
          <SignupForm />
        </div>
      </section>
    </div>
  );
}
