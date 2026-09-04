import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CLOUDINARY_ASSETS } from "../../frontend-next/lib/cloudinary";
import { BRAND_ASSETS, BRAND_PALETTE } from "../lib/brand";

describe("website brand parity", () => {
  it("keeps studio logo sources aligned with the website", () => {
    for (const id of ["roundLogo", "navLogo", "smiley"] as const) {
      expect(BRAND_ASSETS[id]).toEqual(CLOUDINARY_ASSETS[id]);
    }
  });

  it("keeps the core palette aligned with website CSS variables", async () => {
    const css = await readFile(path.resolve(process.cwd(), "../frontend-next/app/globals.css"), "utf8");
    for (const [name, value] of Object.entries(BRAND_PALETTE)) {
      const cssName = name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      expect(css).toContain(`--${cssName}: ${value}`);
    }
  });
});
