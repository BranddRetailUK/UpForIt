import Image from "next/image";
import CloudinaryImage from "./CloudinaryImage";
import NyeCountdown from "./NyeCountdown";
import { CLOUDINARY_ASSETS } from "../lib/cloudinary";

type NyeBlackleyBannerProps = {
  titleId?: string;
  headingLevel?: "h1" | "h2";
  priority?: boolean;
  showStrip?: boolean;
};

export default function NyeBlackleyBanner({
  titleId = "home-nye-blackley-title",
  headingLevel: Heading = "h2",
  priority = false,
  showStrip = true
}: NyeBlackleyBannerProps) {
  return (
    <>
      <section className="nye-hero nye-event__hero nye-event__hero--blackley" aria-labelledby={titleId}>
        <Image className="nye-event__artwork" src="/brand/nye-2026/blackley-hero.png" alt="Blackley" fill sizes="100vw" preload={priority} />
        <div className="section-wrap nye-event__layout">
          <div className="nye-event__copy">
            <CloudinaryImage className="nye-hero__brand" asset={CLOUDINARY_ASSETS.nye2026Logo} alt="UPFORIT" maxWidth={1020} sizes="(max-width: 800px) 85vw, 40vw" priority={priority} />
            <p className="nye-hero__eyebrow">Presents</p>
            <Heading id={titleId} className="nye-hero__title">
              <CloudinaryImage asset={CLOUDINARY_ASSETS.nye2026Title} alt="NYE 2026" sizes="(max-width: 640px) calc(100vw - 36px), (max-width: 696px) calc(100vw - 96px), (max-width: 800px) 600px, (max-width: 1000px) calc((100vw - 128px) / 2.08), (max-width: 1376px) calc((100vw - 156px) / 2.08), 587px" priority={priority} />
            </Heading>
            <Image className="nye-event__artist-logo" src="/brand/nye-2026/blackley-logo.png" alt="Blackley" width={2835} height={587} sizes="(max-width: 800px) 70vw, 360px" />
            <NyeCountdown />
            <p className="nye-hero__venue">McCarthys Sports Bar <span>Bletchley</span></p>

          </div>

        </div>
      </section>
      {showStrip && <div className="nye-event__strip" aria-hidden="true"><span>31.12.26</span><span>BLETCHLEY</span><span>UPFORIT NYE</span><span>31.12.26</span></div>}
    </>
  );
}
