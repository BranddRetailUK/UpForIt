import "server-only";

import { normalizeMerchAccountOrders } from "./merch-account-orders";
import {
  MERCH_STORE_KEY,
  getMerchCheckoutConfirmation,
  goodGamePath,
  goodGameUrl,
  merchApiBase,
  merchSecret,
  revokeGoodGameMerchDiscount,
  signedMerchJsonRequest,
  signMerchRequest
} from "./merch-api";
export type { MerchAccountOrder, MerchAccountOrderItem } from "./merch-account-orders";
export {
  MERCH_STORE_KEY,
  getMerchCheckoutConfirmation,
  goodGamePath,
  goodGameUrl,
  merchSecret,
  revokeGoodGameMerchDiscount,
  signedMerchJsonRequest,
  signMerchRequest
};

export type MerchImage = {
  id: string;
  src: string;
  alt?: string;
  position?: number;
  variantIds?: Array<string | number>;
};

export type MerchVariant = {
  id: string;
  sku: string;
  option1?: string;
  option2?: string;
  option3?: string;
  priceMinor: number;
  weightGrams?: number;
  imageId?: string;
  position?: number;
  available: boolean;
};

export type MerchOption = {
  position: number;
  name: string;
  values: string[];
};

export type MerchProduct = {
  id: string;
  slug: string;
  title: string;
  description: string;
  productKind?: string;
  currency: string;
  priceMinor: number;
  images: MerchImage[];
  options?: MerchOption[];
  variants: MerchVariant[];
};

type CatalogueResponse = {
  products?: MerchProduct[];
  product?: MerchProduct;
};

export async function getMerchAccountOrders(input: { accountId: string; email: string }) {
  if (!merchApiBase() || !merchSecret()) throw new Error("Merch order history is not configured");
  const { response, payload } = await signedMerchJsonRequest("/customer-orders", {
    method: "POST",
    body: {
      accountId: input.accountId,
      customerEmail: input.email.trim().toLowerCase()
    }
  });
  if (!response.ok) throw new Error(`Good Game customer orders returned ${response.status}`);
  return normalizeMerchAccountOrders(payload);
}

async function readCatalogueResponse(response: Response): Promise<CatalogueResponse> {
  if (!response.ok) throw new Error(`Good Game catalogue returned ${response.status}`);
  return response.json() as Promise<CatalogueResponse>;
}

export async function getMerchCatalogue(options: { noStore?: boolean } = {}) {
  if (!merchApiBase()) return [];
  const response = await fetch(goodGameUrl("/catalog"),
    options.noStore
      ? { cache: "no-store" }
      : { next: { revalidate: 60, tags: ["upforit-merch"] } }
  );
  const payload = await readCatalogueResponse(response);
  return Array.isArray(payload.products) ? payload.products : [];
}

export async function getMerchProduct(slug: string) {
  if (!merchApiBase()) return null;
  const response = await fetch(goodGameUrl(`/products/${encodeURIComponent(slug)}`), {
    next: { revalidate: 60, tags: ["upforit-merch", `upforit-product:${slug}`] }
  });
  if (response.status === 404) return null;
  const payload = await readCatalogueResponse(response);
  return payload.product || null;
}

export function formatMerchMoney(valueMinor: number, currency = "gbp") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase()
  }).format(Math.max(0, Number(valueMinor || 0)) / 100);
}
