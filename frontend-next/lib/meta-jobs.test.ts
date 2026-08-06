import { beforeEach, describe, expect, it, vi } from "vitest";
import { decryptJson } from "./security";
import {
  META_JOB_MAX_ATTEMPTS,
  insertMetaConversionJob,
  metaDeliveryDecision,
  metaRetryDelayMinutes,
  shouldQueueTicketPurchase
} from "./meta-jobs";

describe("Meta conversion outbox", () => {
  beforeEach(() => {
    process.env.EMAIL_JOB_ENCRYPTION_KEY = "test-only-email-key-with-more-than-32-characters";
  });

  it("marks successful delivery complete", () => {
    expect(metaDeliveryDecision({ sent: true, status: 200 }, 1)).toEqual({ status: "delivered" });
  });

  it("retries transient failures with bounded exponential backoff", () => {
    expect(metaDeliveryDecision({ sent: false, reason: "request_failed", status: 503 }, 3)).toEqual({
      status: "retry",
      delayMinutes: 4
    });
    expect(metaRetryDelayMinutes(20)).toBe(60);
  });

  it("terminates permanent failures and exhausted jobs", () => {
    expect(metaDeliveryDecision({ sent: false, reason: "invalid_event" }, 1)).toEqual({ status: "dead" });
    expect(metaDeliveryDecision({ sent: false, reason: "request_failed", status: 400 }, 1)).toEqual({ status: "dead" });
    expect(metaDeliveryDecision({ sent: false, reason: "request_failed", status: 503 }, META_JOB_MAX_ATTEMPTS)).toEqual({ status: "dead" });
  });

  it("excludes admin simulations and non-consented orders from Purchase", () => {
    expect(shouldQueueTicketPurchase("stripe", true)).toBe(true);
    expect(shouldQueueTicketPurchase("stripe", false)).toBe(false);
    expect(shouldQueueTicketPurchase("admin_simulation", true)).toBe(false);
  });

  it("inserts an encrypted, event-id-deduplicated job", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1 });
    const input = {
      eventName: "Purchase" as const,
      eventId: "ticket_purchase_abc123",
      eventSourceUrl: "https://www.upforitevents.co.uk/events/summer-roundup-2026",
      valueMinor: 1000,
      currency: "gbp"
    };
    await expect(insertMetaConversionJob({ query } as never, input, { orderId: "order-123" })).resolves.toBe(true);
    const parameters = query.mock.calls[0][1] as unknown[];
    expect(parameters).toEqual(expect.arrayContaining(["order-123", "Purchase", "ticket_purchase_abc123"]));
    expect(String(parameters[4])).not.toContain("summer-roundup-2026");
    expect(decryptJson(parameters[4] as string)).toEqual(input);
    expect(String(query.mock.calls[0][0])).toContain("ON CONFLICT (event_id) DO NOTHING");
  });
});
