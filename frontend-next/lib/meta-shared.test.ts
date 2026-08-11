import { describe, expect, it } from "vitest";
import { isMetaConsentLandingPath } from "./meta-shared";

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
