import { describe, expect, it } from "vitest";
import {
  isMetaConsentLandingPath,
  isMetaMerchTrackingEnabled,
  shouldSendMetaBrowserEvent
} from "./meta-shared";

describe("Meta merch tracking flag", () => {
  it.each([undefined, null, "", "false", "0", "yes"])("fails closed for %s", (value) => {
    expect(isMetaMerchTrackingEnabled(value)).toBe(false);
  });

  it.each(["true", " TRUE "])("enables only an explicit true value: %s", (value) => {
    expect(isMetaMerchTrackingEnabled(value)).toBe(true);
  });

  it("blocks merch browser events while preserving ticket events", () => {
    expect(shouldSendMetaBrowserEvent({ content_category: "merch" }, false)).toBe(false);
    expect(shouldSendMetaBrowserEvent({ content_category: "event tickets" }, false)).toBe(true);
    expect(shouldSendMetaBrowserEvent({ content_category: "merch" }, true)).toBe(true);
  });
});

describe("Meta consent landing routes", () => {
  it.each([
    "/",
    "/events",
    "/events/summer-roundup-2026",
    "/merch",
    "/merch/t-shirt",
    "/cart",
    "/contact",
    "/privacy",
    "/socials"
  ])("allows the first-time consent choice on %s", (pathname) => {
    expect(isMetaConsentLandingPath(pathname)).toBe(true);
  });

  it.each([
    "/admin",
    "/admin/check-in",
    "/account",
    "/account/login",
    "/account/reset-password",
    "/scan",
    "/scan/activate",
    "/staff",
    "/staff/events",
    "/cart/confirmation",
    "/tickets/confirmation"
  ])("does not automatically show the consent choice on %s", (pathname) => {
    expect(isMetaConsentLandingPath(pathname)).toBe(false);
  });

  it("matches complete route segments rather than similarly named public paths", () => {
    expect(isMetaConsentLandingPath("/administrator-info")).toBe(true);
    expect(isMetaConsentLandingPath("/accounting-guide")).toBe(true);
    expect(isMetaConsentLandingPath("scan")).toBe(false);
  });
});
