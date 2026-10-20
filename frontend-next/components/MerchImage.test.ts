import { describe, expect, it } from "vitest";
import { optimizedMerchImageUrl } from "./MerchImage";

const base = "https://res.cloudinary.com/brandduk/image/upload/";

describe("merch image delivery", () => {
  it("constrains the completed upstream crop, preserving versions and public IDs", () => {
    const source = `${base}c_crop,w_1200,h_800,x_100/c_fill,w_600,h_400/v123/products/blue%20shirt.png`;
    expect(optimizedMerchImageUrl(source, 320)).toBe(
      `${base}c_crop,w_1200,h_800,x_100/c_fill,w_600,h_400/f_auto,q_auto,c_limit,w_320/v123/products/blue%20shirt.png`
    );
  });

  it("is idempotent and changes only its terminal delivery step for srcset", () => {
    const source = `${base}c_fill,w_600,h_400/products/shirt.png`;
    const result = optimizedMerchImageUrl(source, 480);
    expect(optimizedMerchImageUrl(result, 480)).toBe(result);
    expect(optimizedMerchImageUrl(result, 240)).toBe(optimizedMerchImageUrl(source, 240));
  });

  it("bounds invalid and excessive width requests", () => {
    for (const width of [NaN, Infinity, 100000]) {
      expect(optimizedMerchImageUrl(`${base}v123/shirt.png`, width)).toContain("w_960/");
    }
    expect(optimizedMerchImageUrl(`${base}shirt.png`, -20)).toContain("w_1/");
  });

  it("preserves signed, token, non-Cloudinary and lookalike URLs", () => {
    for (const source of [
      `${base}s--signature--/v123/shirt.png`,
      `${base}v123/shirt.png?__cld_token__=test`,
      "https://notres.cloudinary.com/brandduk/image/upload/shirt.png",
      "https://cdn.shopify.com/shirt.png",
      "/shirt.png"
    ]) expect(optimizedMerchImageUrl(source, 320)).toBe(source);
  });
});
