import { createHmac } from "node:crypto";

export const MERCH_STORE_KEY = process.env.STANDALONE_STOREFRONT_KEY || "upforit";

export function merchApiBase() {
  return String(process.env.GOOD_GAME_API_BASE || "").trim().replace(/\/+$/, "");
}

export function merchSecret() {
  return String(process.env.STANDALONE_STOREFRONT_UPFORIT_SECRET || "").trim();
}

export function goodGamePath(pathname: string) {
  return `/api/standalone-storefronts/${encodeURIComponent(MERCH_STORE_KEY)}${pathname}`;
}

export function goodGameUrl(pathname: string) {
  const base = merchApiBase();
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
