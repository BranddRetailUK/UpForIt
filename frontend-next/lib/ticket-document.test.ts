import { PDFDocument } from "pdf-lib";
import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.hoisted(() => vi.fn());

vi.mock("./db", () => ({ getPool: () => ({ query }) }));
vi.mock("./security", () => ({ createTicketQrToken: (publicId: string) => `v1.${publicId}.test-signature` }));

import { buildTicketPdf } from "./ticket-document";

describe("ticket PDF", () => {
  beforeEach(() => {
    query.mockReset();
  });

  it("creates one multipage PDF with one QR page per admission ticket", async () => {
    query.mockResolvedValue({
      rows: Array.from({ length: 4 }, (_, index) => ({
        order_number: "UFI-001001",
        display_name: ["Łukasz François", "王小明 🎟️", "A very long ticket holder name ".repeat(20), "Test Buyer"][index],
        event_title: "NYE 2026",
        venue_name: "McCarthys Sports Bar",
        starts_at: new Date("2026-09-26T11:00:00.000Z"),
        timezone: "Europe/London",
        ticket_number: `UFI-T-01000${index + 1}`,
        public_id: `ticket-public-${index + 1}`,
        ticket_type_name: index === 3 ? "General admission — group offer (free)" : "General admission"
      }))
    });

    const bytes = await buildTicketPdf("order-123");
    const pdf = await PDFDocument.load(bytes);

    expect(query).toHaveBeenCalledTimes(1);
    expect(pdf.getPageCount()).toBe(4);
    expect(pdf.getTitle()).toBe("NYE 2026 tickets — UFI-001001");
  });
});
