import { describe, expect, it } from "vitest";
import {
  buildTicketEmailAttachments,
  describeEmailDeliveryError
} from "./email-delivery";

describe("ticket email delivery", () => {
  it("uses SendGrid's required wire-format content_id for an inline QR", () => {
    const attachments = buildTicketEmailAttachments({
      pdf: new Uint8Array([1, 2, 3]),
      singleTicket: true,
      qrImage: Buffer.from([4, 5, 6]),
      qrContentId: "ticket-123@example.com"
    });

    expect(attachments).toHaveLength(2);
    expect(attachments[1]).toMatchObject({
      disposition: "inline",
      content_id: "ticket-123@example.com"
    });
    expect(attachments[1]).not.toHaveProperty("contentId");
  });

  it("keeps multi-ticket messages PDF-only", () => {
    const attachments = buildTicketEmailAttachments({
      pdf: new Uint8Array([1, 2, 3]),
      singleTicket: false
    });

    expect(attachments).toEqual([expect.objectContaining({
      filename: "UPFORIT-tickets.pdf",
      disposition: "attachment"
    })]);
  });

  it("retains SendGrid's useful validation detail", () => {
    const error = Object.assign(new Error("Bad Request"), {
      response: {
        body: {
          errors: [{
            field: "attachments.1.content_id",
            message: "The content_id parameter is required if disposition = 'inline'."
          }]
        }
      }
    });

    expect(describeEmailDeliveryError(error)).toBe(
      "Bad Request: attachments.1.content_id: The content_id parameter is required if disposition = 'inline'."
    );
  });
});
