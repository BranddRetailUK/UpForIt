import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductDisplay from "../../../components/ProductDisplay";
import { getMerchProduct } from "../../../lib/merch";

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
  const titleParts = product.title.split("|").map((part) => part.trim()).filter(Boolean);
  const productTitle = titleParts[0] || product.title;
  const productSubtitle = titleParts.length > 1 ? titleParts.slice(1).join(" ") : "";

  return (
    <div className="inner-page section-wrap product-page">
      <ProductDisplay product={product} productTitle={productTitle} productSubtitle={productSubtitle} />
      {product.description && (
        <section className="product-description" aria-labelledby="product-description-title">
          <h2 id="product-description-title">Product details</h2>
          <div
            className="product-description__content"
            dangerouslySetInnerHTML={{ __html: product.description }}
          />
        </section>
      )}
    </div>
  );
}
