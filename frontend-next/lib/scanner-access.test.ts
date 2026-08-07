import { describe, expect, it } from "vitest";
import {
  scannerDeviceLabel,
  scannerSessionExpiry,
  SCANNER_EVENT_GRACE_HOURS
} from "./scanner-access";

describe("scanner access policy", () => {
  it("expires scanner sessions two hours after an event ends", () => {
    const eventEndsAt = new Date("2026-09-26T22:00:00.000Z");
    expect(SCANNER_EVENT_GRACE_HOURS).toBe(2);
    expect(scannerSessionExpiry(eventEndsAt).toISOString()).toBe("2026-09-27T00:00:00.000Z");
  });

  it("normalizes labels and supplies a device fallback", () => {
    expect(scannerDeviceLabel("  Front   door iPhone  ", 2)).toBe("Front door iPhone");
    expect(scannerDeviceLabel("", 3)).toBe("Door device 3");
    expect(scannerDeviceLabel(null, 4)).toBe("Door device 4");
  });
});
