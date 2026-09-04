import { describe, expect, it } from "vitest";
import { validateVisualJob } from "../lib/validation";
import { artistJob } from "./fixtures";

describe("VisualJobV1 schema", () => {
  it("accepts the locked artist job contract", () => {
    expect(validateVisualJob(artistJob()).content.kind).toBe("artist_batch");
  });

  it("accepts centre, top third or both while rejecting empty and duplicate layout selections", () => {
    for (const layouts of [["center"], ["top_third"], ["center", "top_third"]] as const) {
      const current = artistJob();
      if (current.content.kind === "artist_batch") current.content.layouts = [...layouts];
      expect(validateVisualJob(current).content.kind).toBe("artist_batch");
    }
    const empty = artistJob();
    if (empty.content.kind === "artist_batch") empty.content.layouts = [];
    expect(() => validateVisualJob(empty)).toThrow();
    const duplicate = artistJob();
    if (duplicate.content.kind === "artist_batch") duplicate.content.layouts = ["center", "center"];
    expect(() => validateVisualJob(duplicate)).toThrow();
  });

  it("rejects unsafe canvas and arbitrary executable properties", () => {
    expect(() => validateVisualJob({ ...artistJob(), canvas: { width: 100, height: 1080, fps: 50, durationSeconds: 20 } })).toThrow();
    expect(() => validateVisualJob({ ...artistJob(), executable: "/tmp/run-me" })).toThrow(/additional properties/);
  });

  it("bounds glitch strength and logo duplication", () => {
    const current = artistJob();
    expect(() => validateVisualJob({
      ...current,
      motion: { ...current.motion, glitchAmount: 101 }
    })).toThrow();
    expect(() => validateVisualJob({
      ...current,
      motion: { ...current.motion, logoCopies: 7 }
    })).toThrow();
    expect(() => validateVisualJob({
      ...current,
      motion: { ...current.motion, logoCopies: 2.5 }
    })).toThrow();
  });

  it("accepts the three global styles and a genuine no-logo selection", () => {
    for (const stylePreset of ["website", "neon", "spline"] as const) {
      const current = artistJob();
      expect(validateVisualJob({
        ...current,
        brand: { logoAssetId: "none", palette: "core" },
        motion: { ...current.motion, stylePreset }
      }).motion.stylePreset).toBe(stylePreset);
    }
  });

  it("rejects unknown global visual styles", () => {
    const current = artistJob();
    expect(() => validateVisualJob({
      ...current,
      motion: { ...current.motion, stylePreset: "dark-blue" }
    })).toThrow();
  });
});
