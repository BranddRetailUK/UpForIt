import { describe, expect, it, vi } from "vitest";
import { lockTicketTiersForCheckout } from "./ticket-tiers";

const EVENT_ID = "4e37f654-31f8-4c86-a59e-bf4e72c7f0a1";
const TIER_ID = "8756ca79-53f1-4dd1-9298-c07e85fd10e1";

function checkoutClient(paidQuantity: number) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("SELECT DISTINCT event_id")) {
      return { rowCount: 1, rows: [{ event_id: EVENT_ID }] };
    }
    if (sql.includes("SELECT id, capacity, is_active")) {
      return { rowCount: 1, rows: [{ id: TIER_ID, capacity: 50, is_active: true }] };
    }
    if (sql.includes("GROUP BY i.ticket_type_id")) {
      return { rowCount: 1, rows: [{ ticket_type_id: TIER_ID, paid_quantity: String(paidQuantity) }] };
    }
    if (sql.includes("SELECT tt.id, tt.name")) {
      return { rowCount: 1, rows: [{
        id: TIER_ID,
        name: "Early Bird",
        price_minor: 500,
        currency: "gbp",
        max_per_order: 10,
        capacity: 50,
        event_id: EVENT_ID,
        event_slug: "summer-roundup-2026",
        event_title: "The Summer Roundup"
      }] };
    }
    if (sql.includes("COALESCE(sum(i.quantity)")) {
      expect(sql).toContain("AND o.status = 'paid'");
      expect(sql).not.toContain("pending");
      expect(sql).not.toContain("reserved_until");
      return { rowCount: 1, rows: [{ quantity: String(paidQuantity) }] };
    }
    return { rowCount: 1, rows: [] };
  });
  return { query };
}

describe("ticket checkout availability", () => {
  it("allocates against paid sales only", async () => {
    const client = checkoutClient(49);
    const result = await lockTicketTiersForCheckout(client as never, [{ ticketTypeId: TIER_ID, quantity: 1 }]);
    expect(result.tiers[0]).toMatchObject({ id: TIER_ID, price_minor: 500 });
  });

  it("still prevents one checkout from exceeding the paid tier remainder", async () => {
    const client = checkoutClient(49);
    await expect(lockTicketTiersForCheckout(client as never, [{ ticketTypeId: TIER_ID, quantity: 2 }]))
      .rejects.toThrow("Early Bird has sold out.");
  });
});
