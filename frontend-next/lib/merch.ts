import "server-only";

import { createHmac } from "node:crypto";

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

export const MERCH_STORE_KEY = process.env.STANDALONE_STOREFRONT_KEY || "upforit";

function apiBase() {
  return String(process.env.GOOD_GAME_API_BASE || "").trim().replace(/\/+$/, "");
}

export function merchSecret() {
  return String(process.env.STANDALONE_STOREFRONT_UPFORIT_SECRET || "").trim();
}

export function goodGamePath(pathname: string) {
  return `/api/standalone-storefronts/${encodeURIComponent(MERCH_STORE_KEY)}${pathname}`;
}

export function goodGameUrl(pathname: string) {
  const base = apiBase();
  if (!base) throw new Error("GOOD_GAME_API_BASE is not configured");
  return `${base}${goodGamePath(pathname)}`;
}

export function signMerchRequest({
  timestamp,
  method,
  path,
  body = ""
}: {
  timestamp: string;
  method: string;
  path: string;
  body?: string;
}) {
  const secret = merchSecret();
  if (!secret) throw new Error("UpForIt storefront secret is not configured");
  return createHmac("sha256", secret)
    .update([timestamp, method.toUpperCase(), path, body].join("."))
    .digest("hex");
}

export async function signedMerchJsonRequest(
  pathname: string,
  options: { method?: "GET" | "POST"; body?: Record<string, unknown> } = {}
) {
  const method = options.method || "GET";
  const body = options.body ? JSON.stringify(options.body) : "";
  const path = goodGamePath(pathname);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const response = await fetch(goodGameUrl(pathname), {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      "x-storefront-timestamp": timestamp,
      "x-storefront-signature": signMerchRequest({ timestamp, method, path, body })
    },
    body: body || undefined,
    cache: "no-store"
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  return { response, payload };
}

export function getMerchCheckoutConfirmation(sessionId: string) {
  const query = `?session_id=${encodeURIComponent(sessionId)}`;
  return signedMerchJsonRequest(`/checkout-confirmation${query}`);
}

export function revokeGoodGameMerchDiscount(entitlementId: string) {
  return signedMerchJsonRequest(`/discount-entitlements/${encodeURIComponent(entitlementId)}/revoke`, {
    method: "POST",
    body: {}
  });
}

async function readCatalogueResponse(response: Response): Promise<CatalogueResponse> {
  if (!response.ok) throw new Error(`Good Game catalogue returned ${response.status}`);
  return response.json() as Promise<CatalogueResponse>;
}

export async function getMerchCatalogue(options: { noStore?: boolean } = {}) {
  if (!apiBase()) return [];
  const response = await fetch(goodGameUrl("/catalog"),
    options.noStore
      ? { cache: "no-store" }
      : { next: { revalidate: 60, tags: ["upforit-merch"] } }
  );
  const payload = await readCatalogueResponse(response);
  return Array.isArray(payload.products) ? payload.products : [];
}

export async function getMerchProduct(slug: string) {
  if (!apiBase()) return null;
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
