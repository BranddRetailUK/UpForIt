import { afterEach, describe, expect, it, vi } from "vitest";
import { goodGameUrl, signMerchRequest } from "./merch-api";

describe("worker-safe merchandise API client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("loads outside Next and signs storefront requests", () => {
    vi.stubEnv("GOOD_GAME_API_BASE", "https://good-game.example/");
    vi.stubEnv("STANDALONE_STOREFRONT_UPFORIT_SECRET", "test-secret");

    expect(goodGameUrl("/checkout")).toBe(
      "https://good-game.example/api/standalone-storefronts/upforit/checkout"
    );
    expect(signMerchRequest({
      timestamp: "1700000000",
      method: "POST",
      path: "/api/standalone-storefronts/upforit/checkout",
      body: "{}"
    })).toBe("2941246c3f9c05efc9f64927554a1d3d776e3a693fbd777cbd8d65ddf40af223");
  });
});
