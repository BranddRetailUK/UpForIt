import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductDisplay from "../../../components/ProductDisplay";
import { getMerchProduct } from "../../../lib/merch";
import { splitMerchProductTitle } from "../../../lib/product-title";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getMerchProduct(slug).catch(() => null);
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

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getMerchProduct(slug).catch(() => null);
  if (!product) notFound();
  const { mainTitle: productTitle, subtitle: productSubtitle } = splitMerchProductTitle(product.title);

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
