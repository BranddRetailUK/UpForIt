import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductPurchase from "../../../components/ProductPurchase";
import { formatMerchMoney, getMerchProduct } from "../../../lib/merch";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const product = await getMerchProduct(params.slug).catch(() => null);
  if (!product) return { title: "Merch" };
  return {
    title: product.title,
    description: product.description || `Shop ${product.title} from UPFORIT.`,
    alternates: { canonical: `/merch/${product.slug}` },
    openGraph: {
      title: product.title,
      description: product.description || `Official UPFORIT merch.`,
      images: product.images[0]?.src ? [{ url: product.images[0].src }] : []
    }
  };
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await getMerchProduct(params.slug).catch(() => null);
  if (!product) notFound();
  return (
    <div className="inner-page section-wrap product-page">
      <Link className="merch-back" href="/merch">← Back to merch</Link>
      <div className="product-layout">
        <section className="product-gallery" aria-label={`${product.title} images`}>
          {product.images.map((image, index) => (
            <img key={`${image.id}-${index}`} src={image.src} alt={image.alt || `${product.title} view ${index + 1}`} />
          ))}
        </section>
        <section className="product-summary">
          <p className="comic-kicker comic-kicker--pink">Official UPFORIT gear</p>
          <h1>{product.title}</h1>
          <p className="product-summary__price">From {formatMerchMoney(product.priceMinor, product.currency)}</p>
          {product.description && <div className="product-summary__description">{product.description}</div>}
          <ProductPurchase product={product} />
        </section>
      </div>
    </div>
  );
}
