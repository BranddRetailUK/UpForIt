"use client";

import { useMemo } from "react";
import type { MerchImage, MerchProduct } from "../lib/merch";
import { useCart } from "./CartProvider";
import { useMetaTracking } from "./MetaTrackingProvider";

export default function ProductPurchase({
  product,
  variantId,
  selectedImage,
  onVariantChange
}: {
  product: MerchProduct;
  variantId: string;
  selectedImage?: MerchImage;
  onVariantChange: (variantId: string) => void;
}) {
  const available = product.variants.filter((variant) => variant.available);
  const { addLine } = useCart();
  const { merchTrackingEnabled, track } = useMetaTracking();
  const variant = useMemo(
    () => available.find((entry) => entry.id === variantId) || available[0],
    [available, variantId]
  );
  const options = useMemo(() => {
    const productOptions = product.options?.length ? product.options : [1, 2, 3].map((position) => ({
      position,
      name: `Option ${position}`,
      values: Array.from(new Set(available.map((entry) => String(entry[`option${position}` as "option1"] || "")).filter(Boolean)))
    })).filter((option) => option.values.length > 0);

    return [...productOptions].sort((first, second) => {
      const rank = (name: string) => /colou?r/i.test(name) ? 0 : /^size$/i.test(name) ? 1 : 2;
      return rank(first.name) - rank(second.name) || first.position - second.position;
    });
  }, [available, product.options]);
  if (!variant) return <p className="merch-unavailable">Currently unavailable.</p>;

  function optionValue(entry: (typeof available)[number], position: number) {
    if (position === 1) return String(entry.option1 || "");
    if (position === 2) return String(entry.option2 || "");
    return String(entry.option3 || "");
  }

  function selectOption(position: number, value: string) {
    const matchingCurrent = available.find((entry) => options.every((option) =>
      option.position === position
        ? optionValue(entry, option.position) === value
        : optionValue(entry, option.position) === optionValue(variant, option.position)
    ));
    const next = matchingCurrent || available.find((entry) => optionValue(entry, position) === value);
    if (next) onVariantChange(next.id);
  }

  const variantLabel = options.map((option) => optionValue(variant, option.position)).filter(Boolean).join(" / ");

  const formattedPrice = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: product.currency.toUpperCase()
  }).format(variant.priceMinor / 100);

  function addToCart() {
    addLine({
      productId: product.id,
      productKind: product.productKind || "",
      variantId: variant.id,
      slug: product.slug,
      title: product.title,
      variantLabel,
      imageUrl: selectedImage?.src || product.images[0]?.src || "",
      priceMinor: variant.priceMinor,
      currency: product.currency,
      quantity: 1
    });
    if (merchTrackingEnabled) {
      track("AddToCart", {
        content_ids: [variant.id],
        content_name: product.title,
        content_category: "merch",
        content_type: "product",
        contents: [{ id: variant.id, quantity: 1, item_price: variant.priceMinor / 100 }],
        value: variant.priceMinor / 100,
        currency: product.currency.toUpperCase()
      });
    }
  }

  return (
    <div className="product-purchase">
      <p className="product-summary__price">{formattedPrice}</p>
      <div className="product-purchase__divider" aria-hidden="true" />
      {options.map((option) => (
        <label key={option.position}>
          <span>{option.name}</span>
          <select
            value={optionValue(variant, option.position)}
            onChange={(event) => selectOption(option.position, event.target.value)}
          >
            {option.values.map((value) => <option value={value} key={value}>{value}</option>)}
          </select>
        </label>
      ))}
      <button
        className="pop-button pop-button--pink product-purchase__button"
        type="button"
        onClick={addToCart}
      >
        Add to cart
      </button>
      <p className="product-purchase__note">Made and fulfilled by Good Game Apparel · UK delivery only</p>
    </div>
  );
}
