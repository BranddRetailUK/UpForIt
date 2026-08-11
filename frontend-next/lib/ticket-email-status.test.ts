import { describe, expect, it } from "vitest";
import { getTicketEmailStatus } from "./ticket-email-status";

describe("ticket email admin status", () => {
  it("surfaces an exhausted job as failed", () => {
    expect(getTicketEmailStatus({
      orderStatus: "paid",
      sentAt: null,
      jobStatus: "failed",
      attempts: 5
    })).toEqual({ label: "Failed", tone: "failed" });
  });

  it("distinguishes a retryable failure from an exhausted job", () => {
    expect(getTicketEmailStatus({
      orderStatus: "paid",
      sentAt: null,
      jobStatus: "failed",
      attempts: 2
    }).label).toBe("Retrying");
  });

  it("prefers the sent timestamp over an older failed job state", () => {
    expect(getTicketEmailStatus({
      orderStatus: "paid",
      sentAt: new Date(),
      jobStatus: "failed",
      attempts: 5
    }).label).toBe("Sent");
  });
});
