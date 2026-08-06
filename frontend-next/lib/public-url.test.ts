import { afterEach, describe, expect, it } from "vitest";
import { publicUrl, safeNextPath, verificationUrl } from "./public-url";

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (originalSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
});

describe("publicUrl", () => {
  it("prefers the configured public site over Railway's internal request origin", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.upforitevents.co.uk";

    expect(publicUrl("/account?verified=1", "http://localhost:8080").toString()).toBe(
      "https://www.upforitevents.co.uk/account?verified=1"
    );
  });

  it("uses the request origin as a local-development fallback", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;

    expect(publicUrl("/account/login", "http://localhost:3000").toString()).toBe(
      "http://localhost:3000/account/login"
    );
  });
});

describe("safeNextPath", () => {
  it("preserves an event ticket anchor", () => {
    expect(safeNextPath("/events/summer-roundup-2026#tickets")).toBe(
      "/events/summer-roundup-2026#tickets"
    );
  });

  it.each(["https://example.com", "//example.com", "/\\example.com", "events/summer-roundup-2026"])(
    "rejects unsafe destination %s",
    (destination) => {
      expect(safeNextPath(destination)).toBeUndefined();
    }
  );
});

describe("verificationUrl", () => {
  it("carries the safe post-verification destination in the email link", () => {
    const url = verificationUrl(
      "https://www.upforitevents.co.uk",
      "test-token",
      "/events/summer-roundup-2026#tickets"
    );

    expect(url.origin).toBe("https://www.upforitevents.co.uk");
    expect(url.pathname).toBe("/api/auth/verify");
    expect(url.searchParams.get("token")).toBe("test-token");
    expect(url.searchParams.get("next")).toBe("/events/summer-roundup-2026#tickets");
  });
});
