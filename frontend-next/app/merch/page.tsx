import type { Metadata } from "next";
import Link from "next/link";
import MerchProductCard from "../../components/MerchProductCard";
import { getMerchCatalogue, type MerchProduct } from "../../lib/merch";

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
    <div className="merch-page">
      <header className="page-art-banner page-art-banner--merch">
        <div className="page-art-banner__content section-wrap">
          <h1>UP FOR IT<span>CLOTHING</span></h1>
        </div>
      </header>

      <div className="merch-page__catalogue section-wrap">
      {products.length > 0 ? (
        <section className="merch-grid" aria-label="UPFORIT products">
          {products.map((product, index) => (
            <MerchProductCard product={product} priority={index === 0} key={product.id} />
          ))}
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
    </div>
  );
}
