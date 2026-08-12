"use client";

import { useEffect, useState } from "react";
import type { MerchImage, MerchProduct, MerchVariant } from "../lib/merch";
import ResponsiveMerchImage, { optimizedMerchImageUrl } from "./MerchImage";
import { useMetaTracking } from "./MetaTrackingProvider";
import ProductPurchase from "./ProductPurchase";

function optionValue(variant: MerchVariant, position: number) {
  if (position === 1) return String(variant.option1 || "");
  if (position === 2) return String(variant.option2 || "");
  return String(variant.option3 || "");
}

function directlyMappedImage(product: MerchProduct, variant: MerchVariant) {
  const imageById = variant.imageId
    ? product.images.find((image) => String(image.id) === String(variant.imageId))
    : undefined;

  return imageById || product.images.find((image) =>
    image.variantIds?.some((variantId) => String(variantId) === String(variant.id))
  );
}

function imageForVariant(product: MerchProduct, variant?: MerchVariant): MerchImage | undefined {
  if (!variant) return product.images[0];

  const directImage = directlyMappedImage(product, variant);
  if (directImage) return directImage;

  const colourPosition = product.options?.find((option) => /colou?r/i.test(option.name))?.position || 1;
  const colourValue = optionValue(variant, colourPosition);
  const matchingColourVariant = product.variants.find((entry) =>
    entry.available &&
    optionValue(entry, colourPosition) === colourValue &&
    directlyMappedImage(product, entry)
  );

  return (matchingColourVariant && directlyMappedImage(product, matchingColourVariant)) || product.images[0];
}

export default function ProductDisplay({
  product,
  productTitle,
  productSubtitle
}: {
  product: MerchProduct;
  productTitle: string;
  productSubtitle: string;
}) {
  const { consent, merchTrackingEnabled, track } = useMetaTracking();
  const available = product.variants.filter((variant) => variant.available);
  const [variantId, setVariantId] = useState(available[0]?.id || "");
  const variant = available.find((entry) => entry.id === variantId) || available[0];
  const variantImage = imageForVariant(product, variant);
  const [activeImageId, setActiveImageId] = useState(variantImage?.id || "");
  const focusImage = product.images.find((image) => String(image.id) === String(activeImageId)) || variantImage;
  const additionalImages = product.images.filter((image) => String(image.id) !== String(focusImage?.id));

  useEffect(() => {
    product.images.forEach((image) => {
      const preload = new Image();
      preload.src = optimizedMerchImageUrl(image.src, 960);
    });
  }, [product.images]);

  useEffect(() => {
    if (!merchTrackingEnabled || consent !== "granted") return;
    track("ViewContent", {
      content_ids: [product.id],
      content_name: product.title,
      content_category: "merch",
      content_type: "product",
      value: product.priceMinor / 100,
      currency: product.currency.toUpperCase()
    });
  }, [consent, merchTrackingEnabled, product.currency, product.id, product.priceMinor, product.title, track]);

  function selectVariant(nextVariantId: string) {
    const nextVariant = available.find((entry) => entry.id === nextVariantId);
    setVariantId(nextVariantId);
    setActiveImageId(imageForVariant(product, nextVariant)?.id || "");
  }

  function moveImage(direction: -1 | 1) {
    if (product.images.length < 2) return;
    const currentIndex = product.images.findIndex((image) => String(image.id) === String(focusImage?.id));
    const nextIndex = (Math.max(0, currentIndex) + direction + product.images.length) % product.images.length;
    setActiveImageId(product.images[nextIndex].id);
  }

  return (
    <div className="product-layout">
      <section className="product-gallery" aria-label={`${product.title} images`}>
        {focusImage && (
          <div className="product-gallery__focus-frame">
            <ResponsiveMerchImage
              className="product-gallery__focus"
              src={focusImage.src}
              alt={focusImage.alt || `${product.title} main view`}
              sizes="(max-width: 900px) calc(100vw - 26px), 570px"
              priority
            />
            {product.images.length > 1 && (
              <>
                <button type="button" className="product-gallery__arrow is-previous" onClick={() => moveImage(-1)} aria-label="Show previous product image">←</button>
                <button type="button" className="product-gallery__arrow is-next" onClick={() => moveImage(1)} aria-label="Show next product image">→</button>
              </>
            )}
          </div>
        )}
        {additionalImages.length > 0 && (
          <div className="product-gallery__thumbnails" aria-label={`More ${product.title} images`}>
            {additionalImages.map((image, index) => (
              <ResponsiveMerchImage
                key={`${image.id}-${index}`}
                src={image.src}
                alt={image.alt || `${product.title} view ${index + 2}`}
                sizes="(max-width: 760px) 43vw, 180px"
              />
            ))}
          </div>
        )}
      </section>
      <section className="product-summary">
        <p className="comic-kicker comic-kicker--pink">Official UPFORIT gear</p>
        <h1 className={productSubtitle ? "product-summary__heading--split" : undefined}>
          <span className="product-summary__title">{productTitle}</span>
          {productSubtitle && <span className="product-summary__subtitle">{productSubtitle}</span>}
        </h1>
        <ProductPurchase
          product={product}
          variantId={variant?.id || ""}
          selectedImage={variantImage}
          onVariantChange={selectVariant}
        />
      </section>
    </div>
  );
}
