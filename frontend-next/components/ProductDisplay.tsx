"use client";

import { useState } from "react";
import type { MerchImage, MerchProduct, MerchVariant } from "../lib/merch";
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
  const available = product.variants.filter((variant) => variant.available);
  const [variantId, setVariantId] = useState(available[0]?.id || "");
  const variant = available.find((entry) => entry.id === variantId) || available[0];
  const focusImage = imageForVariant(product, variant);
  const additionalImages = product.images.filter((image) => String(image.id) !== String(focusImage?.id));

  return (
    <div className="product-layout">
      <section className="product-gallery" aria-label={`${product.title} images`}>
        {focusImage && (
          <img
            className="product-gallery__focus"
            src={focusImage.src}
            alt={focusImage.alt || `${product.title} main view`}
          />
        )}
        {additionalImages.length > 0 && (
          <div className="product-gallery__thumbnails" aria-label={`More ${product.title} images`}>
            {additionalImages.map((image, index) => (
              <img key={`${image.id}-${index}`} src={image.src} alt={image.alt || `${product.title} view ${index + 2}`} />
            ))}
          </div>
        )}
      </section>
      <section className="product-summary">
        <p className="comic-kicker comic-kicker--pink">Official UPFORIT gear</p>
        <h1>
          <span className="product-summary__title">{productTitle}</span>
          {productSubtitle && <span className="product-summary__subtitle">{productSubtitle}</span>}
        </h1>
        <ProductPurchase
          product={product}
          variantId={variant?.id || ""}
          selectedImage={focusImage}
          onVariantChange={setVariantId}
        />
      </section>
    </div>
  );
}
