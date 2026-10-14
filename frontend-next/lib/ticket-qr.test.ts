import { describe, expect, it } from "vitest";
import QRCode from "qrcode";
import sharp from "sharp";
import { BinaryBitmap, HybridBinarizer, RGBLuminanceSource, QRCodeReader } from "@zxing/library";
import { createTicketQrToken, verifyTicketQrToken } from "./security";

describe("entry QR encoding and scanning", () => {
  it("decodes a rendered signed ticket with the scanner library", async () => {
    process.env.TICKET_QR_SIGNING_SECRET = "test-only-qr-signing-secret";
    const id = "cfe0cc32-bfce-4e09-9bac-23e8ec304012";
    const token = createTicketQrToken(id);
    const png = await QRCode.toBuffer(token, { type: "png", width: 600, margin: 2, errorCorrectionLevel: "M" });
    const { data, info } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
    const pixels = new Uint8ClampedArray(data);
    const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(pixels, info.width, info.height)));
    const decoded = new QRCodeReader().decode(bitmap).getText();
    expect(decoded).toBe(token);
    expect(verifyTicketQrToken(decoded)).toBe(id);
  });
});
