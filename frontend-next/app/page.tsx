import Link from "next/link";
import CloudinaryImage from "../components/CloudinaryImage";
import MerchProductCard from "../components/MerchProductCard";
import SignupForm from "../components/SignupForm";
import SummerRoundupCard from "../components/SummerRoundupCard";
import TicketMerchPromoBanner from "../components/TicketMerchPromoBanner";
import { CLOUDINARY_ASSETS } from "../lib/cloudinary";
import { getMerchCatalogue, type MerchProduct } from "../lib/merch";

const VALUES = ["Good vibes only", "Respect the ravers", "No bad energy"];

export const revalidate = 60;

export default async function Home() {
  let featuredProducts: MerchProduct[] = [];
  try {
    featuredProducts = (await getMerchCatalogue()).slice(0, 6);
  } catch {
    featuredProducts = [];
  }

  return (
    <>
      <section className="home-hero section-wrap" aria-labelledby="home-title">
        <div className="comic-kicker comic-kicker--pink">Welcome to the party</div>

        <div className="home-hero__lockup">
          <div className="home-hero__shape" aria-hidden="true" />
          <CloudinaryImage
            asset={CLOUDINARY_ASSETS.roundLogo}
            alt="UPFORIT"
            className="home-hero__logo"
            sizes="(max-width: 720px) 82vw, 580px"
            maxWidth={1202}
            priority
          />
        </div>

        <h1 className="sr-only" id="home-title">
          UPFORIT events
        </h1>
        <div className="button-row">
          <Link className="pop-button pop-button--pink" href="/events">
            See what&apos;s next
          </Link>
          <Link className="pop-button pop-button--yellow" href="/merch">
            Check the merch
          </Link>
        </div>
      </section>

      <div className="home-section-divider home-section-divider--hero section-wrap" aria-hidden="true" />

      <section className="values section-wrap" aria-labelledby="values-title">
        <div className="section-heading">
          <span aria-hidden="true">★</span>
          <h2 id="values-title">The house rules</h2>
          <span aria-hidden="true">★</span>
        </div>
        <div className="values__grid">
          {VALUES.map((value, index) => (
            <article className={`value-card value-card--${index + 1}`} key={value}>
              <span className="value-card__number">0{index + 1}</span>
              <h3>{value}</h3>
            </article>
          ))}
        </div>
      </section>

      <section className="home-events events-page section-wrap" aria-label="Featured event">
        <SummerRoundupCard />
      </section>

      <section className="home-ticket-merch-promo section-wrap" aria-label="Ticket-holder merch offer">
        <TicketMerchPromoBanner link />
      </section>

      <section className="home-merch section-wrap" aria-labelledby="home-merch-title">
        <div className="home-section-divider" aria-hidden="true" />
        <div className="section-heading">
          <span aria-hidden="true">★</span>
          <h2 id="home-merch-title">Merch</h2>
          <span aria-hidden="true">★</span>
        </div>
        {featuredProducts.length > 0 ? (
          <div className="merch-grid home-merch__grid" aria-label="Featured UPFORIT products">
            {featuredProducts.map((product) => (
              <MerchProductCard product={product} headingLevel="h3" key={product.id} />
            ))}
          </div>
        ) : null}
        <div className="button-row home-merch__action">
          <Link className="pop-button pop-button--pink" href="/merch">
            Check the merch
          </Link>
        </div>
      </section>

      <section className="signup-section section-wrap" aria-labelledby="signup-heading">
        <div className="sticker-panel sticker-panel--signup">
          <p className="comic-kicker comic-kicker--blue">Don&apos;t miss a drop</p>
          <h2 id="signup-heading">Stay in the loop!</h2>
          <p>
            Be first to hear about new events, lineup news and future merch.
          </p>
          <SignupForm />
        </div>
      </section>
    </>
  );
}
