import sgMail from "@sendgrid/mail";
import { getPool } from "../lib/db";
import { sendMetaConversion } from "../lib/meta-conversion";
import {
  META_JOB_MAX_ATTEMPTS,
  metaDeliveryDecision,
  metaDeliveryError,
  type MetaJobInput
} from "../lib/meta-jobs";
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

type MetaJob = {
  id: string;
  encrypted_payload: string;
  attempts: number;
};

function htmlShell(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#fff019;font-family:Arial,sans-serif;color:#111">
    <div style="max-width:620px;margin:0 auto;padding:32px 20px">
      <div style="background:#fff;border:4px solid #111;padding:28px;box-shadow:9px 9px 0 #f5277d">
        <p style="font-size:32px;font-weight:900;margin:0 0 24px">UPFORIT</p>
        <h1 style="font-size:26px;margin:0 0 18px">${title}</h1>${body}
      </div>
    </div></body></html>`;
}

async function claimEmailJob() {
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

async function deliverEmail(job: Job) {
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
    text = `Hi ${payload.displayName}, your UPFORIT tickets are attached in one PDF, with one page and one unique QR code per admission ticket.`;
    html = htmlShell("Your tickets are here!", `<p>Hi ${payload.displayName},</p><p>Your printable tickets are attached in one PDF. It contains one page and one unique QR code per admission ticket.</p><p>Each QR code admits one person and can only be checked in once. You can also find every ticket any time in your UPFORIT account.</p>${originalRecipientNote}`);
    attachments = [{
      content: Buffer.from(pdf).toString("base64"),
      filename: "UPFORIT-tickets.pdf",
      type: "application/pdf",
      disposition: "attachment"
    }];
  }

  await sgMail.send({
    to,
    from: { email: fromEmail, name: process.env.SENDGRID_FROM_NAME || "UPFORIT Events" },
    replyTo: process.env.SENDGRID_REPLY_TO_EMAIL || fromEmail,
    subject: `${prefix}${subject}`,
    text,
    html,
    attachments,
    trackingSettings: job.job_type === "verify_email" || job.job_type === "reset_password"
      ? { clickTracking: { enable: false, enableText: false } }
      : undefined
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

async function failEmail(job: Job, error: unknown) {
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

async function claimMetaJob() {
  const result = await getPool().query<MetaJob>(
    `WITH next_job AS (
       SELECT id FROM meta_conversion_jobs
        WHERE status IN ('pending', 'retry') AND available_at <= now() AND attempts < $1
        ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
     )
     UPDATE meta_conversion_jobs j
        SET status = 'processing', locked_at = now(), attempts = attempts + 1, updated_at = now()
       FROM next_job WHERE j.id = next_job.id
     RETURNING j.id, j.encrypted_payload, j.attempts`,
    [META_JOB_MAX_ATTEMPTS]
  );
  return result.rows[0] ?? null;
}

async function deliverMeta(job: MetaJob) {
  const payload = decryptJson<MetaJobInput>(job.encrypted_payload);
  const result = await sendMetaConversion(payload);
  const decision = metaDeliveryDecision(result, job.attempts);
  if (decision.status === "delivered") {
    await getPool().query(
      `UPDATE meta_conversion_jobs
          SET status = 'delivered', delivered_at = now(), locked_at = NULL,
              response_status = $2, last_error = NULL, updated_at = now()
        WHERE id = $1`,
      [job.id, result.status ?? null]
    );
    return;
  }

  const error = metaDeliveryError(result);
  if (decision.status === "retry") {
    await getPool().query(
      `UPDATE meta_conversion_jobs
          SET status = 'retry', locked_at = NULL, response_status = $2, last_error = $3,
              available_at = now() + ($4 * interval '1 minute'), updated_at = now()
        WHERE id = $1`,
      [job.id, result.status ?? null, error, decision.delayMinutes]
    );
  } else {
    await getPool().query(
      `UPDATE meta_conversion_jobs
          SET status = 'dead', locked_at = NULL, response_status = $2,
              last_error = $3, updated_at = now()
        WHERE id = $1`,
      [job.id, result.status ?? null, error]
    );
  }
  console.error(`Meta conversion job ${job.id} ${decision.status}: ${error}`);
}

async function recoverStaleJobs() {
  await getPool().query(
    `UPDATE email_jobs
        SET status = 'failed', locked_at = NULL, available_at = now(),
            last_error = COALESCE(last_error, 'Worker lock expired'), updated_at = now()
      WHERE status = 'processing' AND locked_at < now() - interval '15 minutes'`
  );
  await getPool().query(
    `UPDATE meta_conversion_jobs
        SET status = CASE WHEN attempts >= $1 THEN 'dead' ELSE 'retry' END,
            locked_at = NULL, available_at = now(),
            last_error = COALESCE(last_error, 'Worker lock expired'), updated_at = now()
      WHERE status = 'processing' AND locked_at < now() - interval '15 minutes'`,
    [META_JOB_MAX_ATTEMPTS]
  );
}

async function workOnce() {
  let worked = false;
  const emailJob = await claimEmailJob();
  if (emailJob) {
    worked = true;
    try {
      await deliverEmail(emailJob);
    } catch (error) {
      await failEmail(emailJob, error);
    }
  }
  const metaJob = await claimMetaJob();
  if (metaJob) {
    worked = true;
    try {
      await deliverMeta(metaJob);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Meta conversion delivery failed";
      const decision = metaDeliveryDecision({ sent: false, reason: "request_failed" }, metaJob.attempts);
      if (decision.status === "retry") {
        await getPool().query(
          `UPDATE meta_conversion_jobs
              SET status = 'retry', locked_at = NULL, last_error = $2,
                  available_at = now() + ($3 * interval '1 minute'), updated_at = now()
            WHERE id = $1`,
          [metaJob.id, message.slice(0, 1000), decision.delayMinutes]
        );
      } else {
        await getPool().query(
          `UPDATE meta_conversion_jobs
              SET status = 'dead', locked_at = NULL, last_error = $2, updated_at = now()
            WHERE id = $1`,
          [metaJob.id, message.slice(0, 1000)]
        );
      }
      console.error(`Meta conversion job ${metaJob.id} ${decision.status}: ${message}`);
    }
  }
  return worked;
}

async function main() {
  const once = process.argv.includes("--once");
  await recoverStaleJobs();
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
