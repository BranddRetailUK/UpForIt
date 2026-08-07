import { describe, expect, it } from "vitest";
import { normalizeMerchAccountOrders } from "./merch-account-orders";

describe("merch account orders", () => {
  it("normalizes only the safe customer-facing order shape", () => {
    const orders = normalizeMerchAccountOrders({
      orders: [{
        orderNumber: "UFI-00138",
        createdAt: "2026-08-06T12:00:00.000Z",
        status: "delivered",
        currency: "GBP",
        totalMinor: 3897,
        shippingAddress: { address1: "must not pass through" },
        items: [{
          title: "Heavy Tee",
          variant: "Black / M",
          quantity: 1,
          imageUrl: "https://example.com/tee.png",
          lineTotalMinor: 3498,
          costMinor: 100
        }]
      }]
    });
    expect(orders).toEqual([{
      orderNumber: "UFI-00138",
      createdAt: "2026-08-06T12:00:00.000Z",
      status: "delivered",
      currency: "gbp",
      totalMinor: 3897,
      items: [{
        title: "Heavy Tee",
        variant: "Black / M",
        quantity: 1,
        imageUrl: "https://example.com/tee.png",
        lineTotalMinor: 3498
      }]
    }]);
  });

  it("falls back safely for malformed upstream fields", () => {
    expect(normalizeMerchAccountOrders({
      orders: [{
        orderNumber: "UFI-2",
        status: "unknown",
        totalMinor: -20,
        items: [{ imageUrl: "javascript:alert(1)" }]
      }, {}]
    })).toEqual([{
      orderNumber: "UFI-2",
      createdAt: null,
      status: "processing",
      currency: "gbp",
      totalMinor: 0,
      items: [{ title: "Merch item", variant: "", quantity: 1, imageUrl: null, lineTotalMinor: 0 }]
    }]);
  });
});
