export const EMAIL_JOB_MAX_ATTEMPTS = 5;

export type SendGridAttachment = {
  content: string;
  filename: string;
  type: string;
  disposition: "attachment" | "inline";
  content_id?: string;
};

export function buildTicketEmailAttachments(input: {
  pdf: Uint8Array;
  singleTicket: boolean;
  qrImage?: Buffer;
  qrContentId?: string;
}): SendGridAttachment[] {
  const attachments: SendGridAttachment[] = [{
    content: Buffer.from(input.pdf).toString("base64"),
    filename: input.singleTicket ? "UPFORIT-ticket.pdf" : "UPFORIT-tickets.pdf",
    type: "application/pdf",
    disposition: "attachment"
  }];

  if (input.qrImage && input.qrContentId) {
    attachments.push({
      content: input.qrImage.toString("base64"),
      filename: "UPFORIT-ticket-QR.png",
      type: "image/png",
      disposition: "inline",
      // @sendgrid/mail v8 leaves keys inside attachment arrays unchanged.
      // SendGrid's API requires the wire-format key rather than `contentId` here.
      content_id: input.qrContentId
    });
  }

  return attachments;
}

type SendGridResponseError = Error & {
  code?: number;
  response?: {
    statusCode?: number;
    body?: {
      errors?: Array<{ message?: unknown; field?: unknown }>;
    };
  };
};

export function describeEmailDeliveryError(error: unknown) {
  const fallback = error instanceof Error ? error.message : "Email delivery failed";
  if (!(error instanceof Error)) return fallback;

  const responseError = error as SendGridResponseError;
  const providerErrors = responseError.response?.body?.errors;
  if (!Array.isArray(providerErrors) || providerErrors.length === 0) return fallback;

  const details = providerErrors
    .map((entry) => {
      const message = typeof entry.message === "string" ? entry.message.trim() : "";
      const field = typeof entry.field === "string" ? entry.field.trim() : "";
      return message ? `${field ? `${field}: ` : ""}${message}` : "";
    })
    .filter(Boolean)
    .join("; ");

  return details ? `${fallback}: ${details}` : fallback;
}
