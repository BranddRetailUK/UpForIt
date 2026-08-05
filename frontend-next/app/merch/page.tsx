import type { Metadata } from "next";
import Link from "next/link";
import MerchImage from "../../components/MerchImage";
import { formatMerchMoney, getMerchCatalogue, type MerchProduct } from "../../lib/merch";
import { splitMerchProductTitle } from "../../lib/product-title";

export const metadata: Metadata = {
  title: "Merch",
  description: "Shop official UPFORIT event merch, made and fulfilled in the UK.",
  alternates: { canonical: "/merch" }
};

export const dynamic = "force-dynamic";

export default async function MerchPage() {
  let products: MerchProduct[] = [];
  let unavailable = false;
  try {
    products = await getMerchCatalogue({ noStore: true });
  } catch {
    unavailable = true;
  }
  return (
    <div className="inner-page section-wrap merch-page">
      <header className="page-intro merch-intro">
        <div className="merch-title-lockup">
          <h1>Merch</h1>
          <p className="merch-powered-banner">
            <span>Powered by</span>{" "}
            <strong>Good Game Apparel</strong>
          </p>
        </div>
      </header>

      {products.length > 0 ? (
        <section className="merch-grid" aria-label="UPFORIT products">
          {products.map((product, index) => {
            const { mainTitle, subtitle } = splitMerchProductTitle(product.title);
            return (
              <Link className="merch-card" href={`/merch/${product.slug}`} key={product.id}>
                <div className="merch-card__image">
                  <MerchImage
                    src={product.images[0]?.src || ""}
                    alt={product.images[0]?.alt || product.title}
                    sizes="(max-width: 900px) 50vw, 360px"
                    priority={index === 0}
                  />
                  <span>Shop it!</span>
                </div>
                <div className="merch-card__copy">
                  <h2>
                    <span className="merch-card__title-main">{mainTitle}</span>
                    {subtitle && <span className="merch-card__title-subtitle">{subtitle}</span>}
                  </h2>
                  <p>{formatMerchMoney(product.priceMinor, product.currency)}</p>
                </div>
              </Link>
            );
          })}
        </section>
      ) : (
        <section className="placeholder-card" aria-labelledby="merch-status">
          <div className="placeholder-card__splat" aria-hidden="true">!</div>
          <p className="placeholder-card__small">{unavailable ? "Tiny technical timeout" : "Watch this space"}</p>
          <h2 id="merch-status">{unavailable ? "The merch rack is refreshing" : "Merch dropping soon"}</h2>
          <p>{unavailable ? "Give it a moment and try again — the drop will be back shortly." : "The first UPFORIT pieces are getting ready. Follow us so you catch the drop."}</p>
          <Link className="pop-button pop-button--pink" href={unavailable ? "/merch" : "/socials"}>
            {unavailable ? "Try again" : "Follow the drop"}
          </Link>
        </section>
      )}
    </div>
  );
}
