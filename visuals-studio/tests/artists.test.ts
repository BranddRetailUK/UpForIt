import { describe, expect, it } from "vitest";
import {
  artistSafeArea,
  parseArtistNames,
  safeArtistSlug,
  splitArtistName,
  uniqueArtistSlugs
} from "../lib/artists";

describe("artist names", () => {
  it("trims, preserves punctuation and deduplicates case-insensitively", () => {
    expect(parseArtistNames("  DJ O'NEIL  \nMack & Mabel\ndj o'neil\n\nA-B")).toEqual([
      "DJ O'NEIL",
      "Mack & Mabel",
      "A-B"
    ]);
  });

  it("rejects names over 80 characters", () => {
    expect(() => parseArtistNames("A".repeat(81))).toThrow(/80 characters/);
  });

  it("splits long names close to the visual centre", () => {
    expect(splitArtistName("THE EXTRAORDINARILY LONG ARTIST NAME")).toEqual([
      "THE EXTRAORDINARILY",
      "LONG ARTIST NAME"
    ]);
  });

  it("creates safe and unique filenames", () => {
    expect(safeArtistSlug("Mack & Mabel")).toBe("MACK_AND_MABEL");
    expect(uniqueArtistSlugs(["Beyoncé", "Beyonce"])).toEqual(["BEYONCE", "BEYONCE_2"]);
  });

  it("keeps centre and top-third text inside their fixed safe areas", () => {
    expect(artistSafeArea(1920, 1080, "center")).toEqual({
      left: 153.6, right: 1766.4, top: 378, bottom: 702, centerX: 960, centerY: 540
    });
    expect(artistSafeArea(1920, 1080, "top_third")).toEqual({
      left: 153.6, right: 1766.4, top: 54, bottom: 324, centerX: 960, centerY: 194.4
    });
  });
});
