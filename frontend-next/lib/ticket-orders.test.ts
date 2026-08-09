import { describe, expect, it, vi } from "vitest";

vi.mock("./ticket-tiers", () => ({ advanceTicketTierProgression: vi.fn().mockResolvedValue("tier-1") }));

import { fulfilPaidOrder } from "./ticket-orders";

describe("ticket order fulfilment", () => {
  it("issues one independently numbered ticket for every quantity purchased", async () => {
    let orderSequence = 1000;
    let ticketSequence = 10000;
    const query = vi.fn(async (sql: string, _values?: unknown[]) => {
      if (sql.includes("SELECT o.id, o.order_number, o.user_id")) {
        return { rows: [{
          id: "order-123",
          order_number: null,
          user_id: "user-123",
          status: "pending",
          total_minor: 1500,
          currency: "gbp",
          meta_consent_granted: false,
          meta_purchase_event_id: null,
          meta_context_encrypted: null,
          email: "buyer@example.com",
          display_name: "Test Buyer",
          event_title: "The Summer Roundup",
          event_slug: "summer-roundup-2026"
        }] };
      }
      if (sql.includes("SELECT i.id, i.quantity")) {
        return { rows: [{
          id: "item-123",
          quantity: 3,
          ticket_type_name: "Early Bird",
          ticket_type_id: "tier-123",
          unit_price_minor: 500,
          event_id: "event-123"
        }] };
      }
      if (sql.includes("ticket_order_number_seq")) {
        orderSequence += 1;
        return { rows: [{ value: `UFI-${orderSequence}` }] };
      }
      if (sql.includes("admission_ticket_number_seq")) {
        ticketSequence += 1;
        return { rows: [{ value: `UFI-T-${ticketSequence}` }] };
      }
      return { rows: [], rowCount: 1 };
    });

    const fulfilled = await fulfilPaidOrder({ query } as never, "order-123", "pi_123");
    const ticketInserts = query.mock.calls.filter(([sql]) => String(sql).includes("INSERT INTO tickets"));
    const discountInserts = query.mock.calls.filter(([sql]) => String(sql).includes("INSERT INTO merch_discount_entitlements"));

    expect(ticketInserts).toHaveLength(3);
    expect(discountInserts).toHaveLength(1);
    expect(query.mock.calls.filter(([sql]) => String(sql).includes("ticket_order_number_seq"))).toHaveLength(1);
    expect(new Set(ticketInserts.map(([, values]) => (values as unknown[])[2])).size).toBe(3);
    expect(fulfilled).toMatchObject({
      orderId: "order-123",
      orderNumber: "UFI-1001",
      totalMinor: 1500,
      contents: [{ id: "tier-123", quantity: 3, itemPriceMinor: 500 }]
    });
  });
});
