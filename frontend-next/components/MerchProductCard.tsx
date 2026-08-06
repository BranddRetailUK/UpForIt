import Link from "next/link";
import { formatMerchMoney, type MerchProduct } from "../lib/merch";
import { splitMerchProductTitle } from "../lib/product-title";
import MerchImage from "./MerchImage";

export default function MerchProductCard({
  product,
  headingLevel: Heading = "h2",
  priority = false
}: {
  product: MerchProduct;
  headingLevel?: "h2" | "h3";
  priority?: boolean;
}) {
  const { mainTitle, subtitle } = splitMerchProductTitle(product.title);

  return (
    <Link className="merch-card" href={`/merch/${product.slug}`}>
      <div className="merch-card__image">
        <MerchImage
          src={product.images[0]?.src || ""}
          alt={product.images[0]?.alt || product.title}
          sizes="(max-width: 900px) 50vw, 360px"
          priority={priority}
        />
        <span>Shop it!</span>
      </div>
      <div className="merch-card__copy">
        <Heading className={subtitle ? "merch-card__heading--split" : undefined}>
          <span className="merch-card__title-main">{mainTitle}</span>
          {subtitle && <span className="merch-card__title-subtitle">{subtitle}</span>}
        </Heading>
        <p>{formatMerchMoney(product.priceMinor, product.currency)}</p>
      </div>
    </Link>
  );
}
