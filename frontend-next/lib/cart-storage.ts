export const LEGACY_CART_STORAGE_KEY = "upforit.merch.cart.v1";
export const LEGACY_CHECKOUT_INTENT_STORAGE_KEY = "upforit.merch.checkout-intent.v1";
export const CART_STORAGE_PREFIX = "upforit.merch.cart.v2.user";
export const CHECKOUT_INTENT_STORAGE_PREFIX = "upforit.merch.checkout-intent.v2";
export const CART_AUTH_CHANGED_EVENT = "upforit:auth-changed";
export const CART_AUTH_SYNC_STORAGE_KEY = "upforit.auth.changed.v1";

export function userCartStorageKey(accountId: string | null | undefined) {
  const normalized = String(accountId || "").trim().toLowerCase();
  return normalized ? `${CART_STORAGE_PREFIX}.${normalized}` : null;
}

export function checkoutIntentStorageKey(accountId: string | null | undefined) {
  const normalized = String(accountId || "").trim().toLowerCase();
  return `${CHECKOUT_INTENT_STORAGE_PREFIX}.${normalized || "guest-session"}`;
}

export function notifyCartAuthChanged() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CART_AUTH_SYNC_STORAGE_KEY,
      `${Date.now()}:${window.crypto.randomUUID()}`
    );
  } catch {
    // The in-tab event still isolates the cart when storage is unavailable.
  }
  window.dispatchEvent(new Event(CART_AUTH_CHANGED_EVENT));
}
