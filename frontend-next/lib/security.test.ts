import { beforeEach, describe, expect, it } from "vitest";
import { createTicketQrToken, decryptJson, encryptJson, verifyTicketQrToken } from "./security";

describe("ticket and email security helpers", () => {
  beforeEach(() => {
    process.env.TICKET_QR_SIGNING_SECRET = "test-only-qr-secret-with-more-than-32-characters";
    process.env.EMAIL_JOB_ENCRYPTION_KEY = "test-only-email-key-with-more-than-32-characters";
  });

  it("accepts an authentic ticket token and rejects a changed signature", () => {
    const publicId = "4e37f654-31f8-4c86-a59e-bf4e72c7f0a1";
    const token = createTicketQrToken(publicId);
    expect(verifyTicketQrToken(token)).toBe(publicId);
    expect(verifyTicketQrToken(`${token.slice(0, -1)}x`)).toBeNull();
  });

  it("encrypts and restores email payloads without storing plaintext", () => {
    const payload = { to: "buyer@example.com", orderId: "order-123" };
    const encrypted = encryptJson(payload);
    expect(encrypted).not.toContain(payload.to);
    expect(decryptJson(encrypted)).toEqual(payload);
  });

  it("verifies exact signing keys with surrounding whitespace and retains existing trimmed-key tickets", () => {
    const publicId = "4e37f654-31f8-4c86-a59e-bf4e72c7f0a1";
    const previous = createTicketQrToken(publicId);
    process.env.TICKET_QR_SIGNING_SECRET = ` ${process.env.TICKET_QR_SIGNING_SECRET}\n`;
    expect(verifyTicketQrToken(createTicketQrToken(publicId))).toBe(publicId);
    expect(verifyTicketQrToken(previous)).toBe(publicId);
  });

  it("rejects a ticket issued using another environment's signing key", () => {
    const token = createTicketQrToken("4e37f654-31f8-4c86-a59e-bf4e72c7f0a1");
    process.env.TICKET_QR_SIGNING_SECRET = "different-environment-secret-with-more-than-32-characters";
    expect(verifyTicketQrToken(token)).toBeNull();
  });
});
