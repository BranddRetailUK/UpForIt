import { describe, expect, it } from "vitest";
import { compileFlashEvents, createSafetyReport, maximumEventsInRollingSecond } from "../lib/safety";
import { artistJob } from "./fixtures";

describe("flash safety", () => {
  it("never schedules more than two events in a rolling second", () => {
    for (const level of ["low", "medium", "high"] as const) {
      const events = compileFlashEvents(level, 30, "flash_pulse");
      expect(maximumEventsInRollingSecond(events)).toBeLessThanOrEqual(2);
    }
  });

  it("uses one combined clock for artist text and background flashes", () => {
    const report = createSafetyReport(artistJob());
    expect(report.passed).toBe(true);
    expect(report.maximumEventsInRollingSecond).toBeLessThanOrEqual(2);
    expect(report.saturatedRedUsed).toBe(false);
  });

  it("recalibrates the previous high flash cadence as medium without breaking the cap", () => {
    const medium = compileFlashEvents("medium", 20, "flash_pulse");
    const high = compileFlashEvents("high", 20, "flash_pulse");
    expect(medium).toEqual(high);
    expect(maximumEventsInRollingSecond(medium)).toBe(2);
  });

  it("disables deliberate flashes for steady glow", () => {
    expect(compileFlashEvents("high", 20, "steady_glow")).toEqual([]);
  });
});
