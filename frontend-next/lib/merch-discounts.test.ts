import { describe, expect, it, vi } from "vitest";

const { poolQuery } = vi.hoisted(() => ({ poolQuery: vi.fn() }));
vi.mock("./db", () => ({ getPool: () => ({ query: poolQuery }) }));

import {
  calculateTicketMerchDiscountMinor,
  grantTicketMerchDiscount,
  reconcileMerchDiscountFromConfirmation,
  revokeUnusedMerchDiscountForTicketOrder
} from "./merch-discounts";

describe("ticket-holder merch discounts", () => {
  it("rounds 20% of the merchandise subtotal in minor units", () => {
    expect(calculateTicketMerchDiscountMinor(2499)).toBe(500);
    expect(calculateTicketMerchDiscountMinor(0)).toBe(0);
  });

  it("grants at most one lifetime entitlement per account and excludes simulations", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [{ id: "entitlement" }] });
    expect(await grantTicketMerchDiscount({ query } as never, {
      userId: "user-1",
      ticketOrderId: "order-1",
      source: "admin_simulation"
    })).toBe(false);
    expect(query).not.toHaveBeenCalled();

    expect(await grantTicketMerchDiscount({ query } as never, {
      userId: "user-1",
      ticketOrderId: "order-1",
      source: "stripe"
    })).toBe(true);
    expect(String(query.mock.calls[0][0])).toContain("ON CONFLICT (user_id) DO NOTHING");
  });

  it("revokes only an unused entitlement and queues its upstream revocation", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: "entitlement-1", stripe_checkout_session_id: "cs_1" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "job-1" }] });
    const revoked = await revokeUnusedMerchDiscountForTicketOrder({ query } as never, "order-1");
    expect(revoked).toEqual({ id: "entitlement-1", stripe_checkout_session_id: "cs_1" });
    expect(String(query.mock.calls[0][0])).toContain("status IN ('available', 'reserved')");
    expect(query.mock.calls[1][1]).toEqual(expect.arrayContaining(["revoke:entitlement-1"]));
  });

  it("marks a matching paid checkout redeemed", async () => {
    poolQuery.mockReset().mockResolvedValue({ rowCount: 1, rows: [] });
    await reconcileMerchDiscountFromConfirmation({
      entitlementId: "entitlement-1",
      checkoutSessionId: "cs_1",
      paid: true,
      status: "processed"
    });
    expect(String(poolQuery.mock.calls[0][0])).toContain("status = 'redeemed'");
    expect(poolQuery.mock.calls[0][1]).toEqual(["entitlement-1", "cs_1"]);
  });
});
