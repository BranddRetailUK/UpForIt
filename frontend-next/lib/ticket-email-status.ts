import { EMAIL_JOB_MAX_ATTEMPTS } from "./email-delivery";

export type TicketEmailStatus = {
  label: "Sent" | "Failed" | "Retrying" | "Sending" | "Queued" | "—";
  tone: "sent" | "failed" | "retrying" | "neutral";
};

export function getTicketEmailStatus(input: {
  orderStatus: string;
  sentAt: Date | null;
  jobStatus: string | null;
  attempts: number | null;
}): TicketEmailStatus {
  if (input.sentAt || input.jobStatus === "sent") return { label: "Sent", tone: "sent" };
  if (input.jobStatus === "failed") {
    return input.attempts !== null && input.attempts >= EMAIL_JOB_MAX_ATTEMPTS
      ? { label: "Failed", tone: "failed" }
      : { label: "Retrying", tone: "retrying" };
  }
  if (input.jobStatus === "processing") return { label: "Sending", tone: "retrying" };
  if (input.jobStatus === "pending" || input.orderStatus === "paid") return { label: "Queued", tone: "neutral" };
  return { label: "—", tone: "neutral" };
}
