import { describe, expect, it } from "vitest";
import {
  CART_STORAGE_PREFIX,
  CHECKOUT_INTENT_STORAGE_PREFIX,
  checkoutIntentStorageKey,
  userCartStorageKey
} from "./cart-storage";

describe("userCartStorageKey", () => {
  it("does not create persistent storage for anonymous visitors", () => {
    expect(userCartStorageKey(null)).toBeNull();
    expect(userCartStorageKey(undefined)).toBeNull();
    expect(userCartStorageKey("  ")).toBeNull();
  });

  it("isolates persistent carts by account", () => {
    const first = userCartStorageKey("ACCOUNT-A");
    const second = userCartStorageKey("account-b");

    expect(first).toBe(`${CART_STORAGE_PREFIX}.account-a`);
    expect(userCartStorageKey("account-a")).toBe(first);
    expect(second).toBe(`${CART_STORAGE_PREFIX}.account-b`);
    expect(first).not.toBe(second);
  });

  it("separates checkout retries between accounts", () => {
    expect(checkoutIntentStorageKey("account-a")).toBe(
      `${CHECKOUT_INTENT_STORAGE_PREFIX}.account-a`
    );
    expect(checkoutIntentStorageKey("account-b")).not.toBe(
      checkoutIntentStorageKey("account-a")
    );
    expect(checkoutIntentStorageKey(null)).toBe(
      `${CHECKOUT_INTENT_STORAGE_PREFIX}.guest-session`
    );
  });
});
