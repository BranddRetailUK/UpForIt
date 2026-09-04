import { describe, expect, it } from "vitest";
import { hasExactPostscriptFont } from "../lib/system";

describe("artist font readiness", () => {
  it("requires the exact Panton Black Caps PostScript name", () => {
    expect(hasExactPostscriptFont("Panton-BlackCaps\n")).toBe(true);
    expect(hasExactPostscriptFont("Panton Black Caps\n")).toBe(false);
    expect(hasExactPostscriptFont("Panton-Black\n")).toBe(false);
    expect(hasExactPostscriptFont("")).toBe(false);
  });
});
