import sgMail from "@sendgrid/mail";
import { getPool } from "../lib/db";
import { decryptJson } from "../lib/security";
import { buildTicketPdf } from "../lib/ticket-document";

type Job = {
  id: string;
  job_type: "verify_email" | "reset_password" | "ticket_confirmation";
  order_id: string | null;
  encrypted_payload: string;
  attempts: number;
};

type Payload = { to: string; displayName: string; url?: string; orderId?: string };

function htmlShell(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#fff019;font-family:Arial,sans-serif;color:#111">
    <div style="max-width:620px;margin:0 auto;padding:32px 20px">
      <div style="background:#fff;border:4px solid #111;padding:28px;box-shadow:9px 9px 0 #f5277d">
        <p style="font-size:32px;font-weight:900;margin:0 0 24px">UPFORIT</p>
        <h1 style="font-size:26px;margin:0 0 18px">${title}</h1>${body}
      </div>
    </div></body></html>`;
}

async function claimJob() {
  const result = await getPool().query<Job>(
    `WITH next_job AS (
       SELECT id FROM email_jobs
        WHERE status IN ('pending', 'failed') AND available_at <= now() AND attempts < 5
        ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
     )
     UPDATE email_jobs j SET status = 'processing', locked_at = now(), attempts = attempts + 1, updated_at = now()
       FROM next_job WHERE j.id = next_job.id
     RETURNING j.id, j.job_type, j.order_id, j.encrypted_payload, j.attempts`
  );
  return result.rows[0] ?? null;
}

async function deliver(job: Job) {
  const payload = decryptJson<Payload>(job.encrypted_payload);
  const apiKey = process.env.SENDGRID_API_KEY || process.env.SENDGRID_ACCESS_KEY || process.env.SNEDGRID_ACCESS_KEY;
  if (!apiKey) throw new Error("SENDGRID_API_KEY (or a legacy SendGrid access-key alias) is not set");
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!fromEmail) throw new Error("SENDGRID_FROM_EMAIL is not set");
  sgMail.setApiKey(apiKey);

  const testingRecipient = process.env.EMAIL_FORCE_RECIPIENT?.trim();
  const to = testingRecipient || payload.to;
  const prefix = process.env.EMAIL_SUBJECT_PREFIX?.trim() || "";
  const originalRecipientNote = testingRecipient
    ? `<p style="font-size:12px;color:#555">Testing redirect: originally addressed to ${payload.to}</p>`
    : "";
  let subject: string;
  let text: string;
  let html: string;
  let attachments: Array<{ content: string; filename: string; type: string; disposition: string }> | undefined;

  if (job.job_type === "verify_email") {
    subject = "Verify your UPFORIT account";
    text = `Hi ${payload.displayName}, verify your account: ${payload.url}`;
    html = htmlShell("Verify your account", `<p>Hi ${payload.displayName},</p><p>Tap the button to verify your email and finish setting up your account.</p><p><a style="display:inline-block;background:#fff019;border:3px solid #111;color:#111;padding:12px 18px;font-weight:bold;text-decoration:none" href="${payload.url}">Verify email</a></p>${originalRecipientNote}`);
  } else if (job.job_type === "reset_password") {
    subject = "Reset your UPFORIT password";
    text = `Hi ${payload.displayName}, reset your password: ${payload.url}`;
    html = htmlShell("Reset your password", `<p>Hi ${payload.displayName},</p><p>This link expires in one hour.</p><p><a style="display:inline-block;background:#fff019;border:3px solid #111;color:#111;padding:12px 18px;font-weight:bold;text-decoration:none" href="${payload.url}">Choose a new password</a></p>${originalRecipientNote}`);
  } else {
    if (!payload.orderId) throw new Error("Ticket confirmation job is missing orderId");
    const pdf = await buildTicketPdf(payload.orderId);
    subject = "Your UPFORIT tickets";
    text = `Hi ${payload.displayName}, your UPFORIT tickets are attached. Each QR code admits one person.`;
    html = htmlShell("Your tickets are here!", `<p>Hi ${payload.displayName},</p><p>Your printable QR-code tickets are attached. Each QR code admits one person and can only be checked in once.</p><p>You can also find your tickets any time in your UPFORIT account.</p>${originalRecipientNote}`);
    attachments = [{
      content: Buffer.from(pdf).toString("base64"),
      filename: "UPFORIT-tickets.pdf",
      type: "application/pdf",
      disposition: "attachment"
    }];
  }

  await sgMail.send({
    to,
    from: { email: fromEmail, name: process.env.SENDGRID_FROM_NAME || "UPFORIT Tickets" },
    replyTo: process.env.SENDGRID_REPLY_TO_EMAIL || fromEmail,
    subject: `${prefix}${subject}`,
    text,
    html,
    attachments
  });
  await getPool().query(
    `UPDATE email_jobs SET status = 'sent', sent_at = now(), locked_at = NULL, last_error = NULL, updated_at = now()
      WHERE id = $1`,
    [job.id]
  );
  if (job.job_type === "ticket_confirmation" && job.order_id) {
    await getPool().query(
      "UPDATE ticket_orders SET confirmation_email_sent_at = now(), updated_at = now() WHERE id = $1",
      [job.order_id]
    );
  }
}

async function fail(job: Job, error: unknown) {
  const message = error instanceof Error ? error.message : "Email delivery failed";
  const delayMinutes = Math.min(60, 2 ** job.attempts);
  await getPool().query(
    `UPDATE email_jobs SET status = 'failed', locked_at = NULL, last_error = $2,
       available_at = now() + ($3 * interval '1 minute'), updated_at = now()
     WHERE id = $1`,
    [job.id, message.slice(0, 1000), delayMinutes]
  );
  console.error(`Email job ${job.id} failed: ${message}`);
}

async function workOnce() {
  const job = await claimJob();
  if (!job) return false;
  try {
    await deliver(job);
  } catch (error) {
    await fail(job, error);
  }
  return true;
}

async function main() {
  const once = process.argv.includes("--once");
  do {
    const worked = await workOnce();
    if (once) break;
    if (!worked) await new Promise((resolve) => setTimeout(resolve, 5000));
  } while (true);
  await getPool().end();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
