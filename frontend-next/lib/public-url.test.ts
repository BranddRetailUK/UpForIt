import { afterEach, describe, expect, it } from "vitest";
import { publicUrl } from "./public-url";

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
