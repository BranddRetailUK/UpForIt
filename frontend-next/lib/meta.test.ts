import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildMetaEvent,
  getMetaRequestContext,
  hashMetaValue,
  metaAdsTimeRange,
  metaEventId,
  parseMetaAdsSummary
} from "./meta";

describe("Meta measurement helpers", () => {
  it("normalises and hashes user values", () => {
    expect(hashMetaValue(" Test@Example.COM ")).toBe(
      "973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b"
    );
  });

  it("builds a purchase event without leaking the checkout query", () => {
    const event = buildMetaEvent({
      eventName: "Purchase",
      eventId: "purchase_order-123",
      eventTime: 1_700_000_000,
      eventSourceUrl: "https://www.upforitevents.co.uk/tickets/confirmation?session_id=secret",
      valueMinor: 4500,
      currency: "gbp",
      contentName: "Summer Roundup",
      contents: [{ id: "tier-1", quantity: 2, itemPriceMinor: 2250 }],
      userData: { email: " Test@Example.COM " }
    });

    expect(event).toMatchObject({
      event_name: "Purchase",
      event_time: 1_700_000_000,
      event_id: "purchase_order-123",
      action_source: "website",
      event_source_url: "https://www.upforitevents.co.uk/tickets/confirmation",
      user_data: {
        em: ["973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b"]
      },
      custom_data: {
        value: 45,
        currency: "GBP",
        content_name: "Summer Roundup",
        contents: [{ id: "tier-1", quantity: 2, item_price: 22.5 }],
        content_ids: ["tier-1"],
        content_type: "product",
        num_items: 2
      }
    });
  });

  it("requires consent and validates browser attribution", () => {
    const request = new Request("https://www.upforitevents.co.uk/api/signup", {
      headers: {
        cookie: "upforit_meta_consent=granted; _fbp=fb.1.1700000000.1234",
        "user-agent": "UPFORIT test browser",
        "x-forwarded-for": "203.0.113.7, 10.0.0.1"
      }
    });
    expect(getMetaRequestContext(request, {
      eventId: "lead_123",
      fbc: "not-valid"
    })).toEqual({
      consent: true,
      eventId: "lead_123",
      fbp: "fb.1.1700000000.1234",
      fbc: undefined,
      clientIp: "203.0.113.7",
      clientUserAgent: "UPFORIT test browser"
    });
  });

  it("uses preferred Meta action types without double-counting fallbacks", () => {
    expect(parseMetaAdsSummary({
      data: [{
        date_start: "2026-07-07",
        date_stop: "2026-08-05",
        spend: "100.50",
        impressions: "12000",
        reach: "9000",
        clicks: "250",
        inline_link_clicks: "200",
        ctr: "2.0833",
        cpc: "0.402",
        actions: [
          { action_type: "offsite_conversion.fb_pixel_purchase", value: "4" },
          { action_type: "purchase", value: "9" },
          { action_type: "lead", value: "11" }
        ],
        action_values: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: "240" }],
        purchase_roas: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: "2.388" }]
      }]
    })).toMatchObject({
      state: "ready",
      spend: 100.5,
      purchases: 4,
      purchaseValue: 240,
      purchaseRoas: 2.388,
      leads: 11
    });
  });

  it("includes today in the rolling 30-day Meta reporting range", () => {
    expect(metaAdsTimeRange(new Date("2026-08-10T14:00:00Z"))).toEqual({
      since: "2026-07-12",
      until: "2026-08-10"
    });
    expect(metaAdsTimeRange(new Date("2026-08-10T23:30:00Z"))).toEqual({
      since: "2026-07-13",
      until: "2026-08-11"
    });
  });

  it("creates stable, Meta-safe server event IDs", () => {
    expect(metaEventId("Ticket Purchase", "order-123")).toBe(metaEventId("Ticket Purchase", "order-123"));
    expect(metaEventId("Ticket Purchase", "order-123")).toMatch(/^ticket_purchase_[a-f0-9]{32}$/);
  });
});
