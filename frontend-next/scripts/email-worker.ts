import sgMail from "@sendgrid/mail";
import QRCode from "qrcode";
import { getPool } from "../lib/db";
import {
  resetPasswordEmailHtml,
  ticketConfirmationEmailHtml,
  verificationEmailHtml
} from "../lib/email-templates";
import { sendMetaConversion } from "../lib/meta-conversion";
import { getMerchCheckoutConfirmation, revokeGoodGameMerchDiscount } from "../lib/merch";
import {
  MERCH_DISCOUNT_SYNC_MAX_ATTEMPTS,
  merchDiscountRetryDelayMinutes,
  reconcileMerchDiscountFromConfirmation
} from "../lib/merch-discounts";
import {
  META_JOB_MAX_ATTEMPTS,
  metaDeliveryDecision,
  metaDeliveryError,
  type MetaJobInput
} from "../lib/meta-jobs";
import { createTicketQrToken, decryptJson } from "../lib/security";
import { buildTicketPdf, getTicketDocumentRows } from "../lib/ticket-document";

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

type MerchDiscountSyncJob = {
  id: string;
  entitlement_id: string;
  action: "reconcile" | "revoke";
  stripe_checkout_session_id: string | null;
  attempts: number;
};

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
  const originalRecipient = testingRecipient ? payload.to : undefined;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.upforitevents.co.uk";
  let subject: string;
  let text: string;
  let html: string;
  let attachments: Array<{
    content: string;
    filename: string;
    type: string;
    disposition: string;
    contentId?: string;
  }> | undefined;

  if (job.job_type === "verify_email") {
    subject = "Verify your UPFORIT account";
    if (!payload.url) throw new Error("Verification email job is missing url");
    text = `Hi ${payload.displayName},\n\nVerify your UPFORIT account:\n${payload.url}\n\nThis one-time link expires after 24 hours. If you did not create this account, ignore this email.`;
    html = verificationEmailHtml({ displayName: payload.displayName, url: payload.url, siteUrl, originalRecipient });
  } else if (job.job_type === "reset_password") {
    subject = "Reset your UPFORIT password";
    if (!payload.url) throw new Error("Password reset email job is missing url");
    text = `Hi ${payload.displayName},\n\nChoose a new UPFORIT password:\n${payload.url}\n\nThis one-time link expires in one hour. If you did not request it, ignore this email.`;
    html = resetPasswordEmailHtml({ displayName: payload.displayName, url: payload.url, siteUrl, originalRecipient });
  } else {
    if (!payload.orderId) throw new Error("Ticket confirmation job is missing orderId");
    const ticketRows = await getTicketDocumentRows(payload.orderId);
    const pdf = await buildTicketPdf(payload.orderId, ticketRows);
    const singleTicket = ticketRows.length === 1 ? ticketRows[0] : undefined;
    const qrContentId = singleTicket ? `upforit-ticket-${singleTicket.public_id}@upforitevents.co.uk` : undefined;
    const qrImage = singleTicket
      ? await QRCode.toBuffer(createTicketQrToken(singleTicket.public_id), {
          type: "png",
          width: 600,
          margin: 2,
          errorCorrectionLevel: "M"
        })
      : undefined;
    subject = singleTicket ? "Your UPFORIT ticket" : "Your UPFORIT tickets";
    text = singleTicket
      ? `Hi ${payload.displayName},\n\nYour UPFORIT ticket is attached as a PDF. Its unique QR code is also included in the HTML email for quick access on your phone. Keep both private and show the QR code at entry.\n\nView your account: ${new URL("/account", siteUrl).toString()}`
      : `Hi ${payload.displayName},\n\nYour UPFORIT tickets are attached in one PDF, with one page and one unique QR code per admission ticket. Save the PDF to your phone and show each QR code at entry.\n\nView your account: ${new URL("/account", siteUrl).toString()}`;
    html = ticketConfirmationEmailHtml({
      displayName: payload.displayName,
      accountUrl: new URL("/account", siteUrl).toString(),
      siteUrl,
      originalRecipient,
      singleTicketQrCid: qrContentId,
      singleTicketNumber: singleTicket?.ticket_number
    });
    attachments = [
      {
        content: Buffer.from(pdf).toString("base64"),
        filename: singleTicket ? "UPFORIT-ticket.pdf" : "UPFORIT-tickets.pdf",
        type: "application/pdf",
        disposition: "attachment"
      },
      ...(qrImage && qrContentId
        ? [{
            content: qrImage.toString("base64"),
            filename: "UPFORIT-ticket-QR.png",
            type: "image/png",
            disposition: "inline",
            contentId: qrContentId
          }]
        : [])
    ];
  }

  await sgMail.send({
    to,
    from: { email: fromEmail, name: process.env.SENDGRID_FROM_NAME || "UPFORIT Events" },
    replyTo: process.env.SENDGRID_REPLY_TO_EMAIL || fromEmail,
    subject: `${prefix}${subject}`,
    text,
    html,
    attachments,
    trackingSettings: { clickTracking: { enable: false, enableText: false } }
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

async function claimMerchDiscountSyncJob() {
  const result = await getPool().query<MerchDiscountSyncJob>(
    `WITH next_job AS (
       SELECT id FROM merch_discount_sync_jobs
        WHERE status IN ('pending', 'retry') AND available_at <= now() AND attempts < $1
        ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
     )
     UPDATE merch_discount_sync_jobs j
        SET status = 'processing', locked_at = now(), attempts = attempts + 1, updated_at = now()
       FROM next_job WHERE j.id = next_job.id
     RETURNING j.id, j.entitlement_id, j.action, j.stripe_checkout_session_id, j.attempts`,
    [MERCH_DISCOUNT_SYNC_MAX_ATTEMPTS]
  );
  return result.rows[0] ?? null;
}

async function deliverMerchDiscountSync(job: MerchDiscountSyncJob) {
  if (job.action === "revoke") {
    const { response, payload } = await revokeGoodGameMerchDiscount(job.entitlement_id);
    if (!response.ok) throw new Error(String(payload.error || "Good Game discount revocation failed"));
    if (String(payload.status || "") === "redeemed") {
      await getPool().query(
        `UPDATE merch_discount_entitlements
            SET status = 'redeemed', redeemed_at = COALESCE(redeemed_at, now()), updated_at = now()
          WHERE id = $1`,
        [job.entitlement_id]
      );
    }
  } else {
    if (!job.stripe_checkout_session_id) throw new Error("Discount reconciliation is missing checkout session");
    const { response, payload } = await getMerchCheckoutConfirmation(job.stripe_checkout_session_id);
    if (!response.ok) throw new Error(String(payload.error || "Good Game discount reconciliation failed"));
    const status = String(payload.status || "");
    const terminal = payload.paid === true || ["processed", "expired", "payment_failed", "failed"].includes(status);
    if (!terminal) throw new Error(`Discount checkout is still ${status || "pending"}`);
    await reconcileMerchDiscountFromConfirmation({
      entitlementId: String(payload.discountEntitlementId || job.entitlement_id),
      checkoutSessionId: job.stripe_checkout_session_id,
      paid: payload.paid === true,
      status
    });
  }
  await getPool().query(
    `UPDATE merch_discount_sync_jobs
        SET status = 'delivered', delivered_at = now(), locked_at = NULL,
            last_error = NULL, updated_at = now()
      WHERE id = $1`,
    [job.id]
  );
}

async function failMerchDiscountSync(job: MerchDiscountSyncJob, error: unknown) {
  const message = error instanceof Error ? error.message : "Merch discount sync failed";
  const terminal = job.attempts >= MERCH_DISCOUNT_SYNC_MAX_ATTEMPTS;
  await getPool().query(
    `UPDATE merch_discount_sync_jobs
        SET status = $2, locked_at = NULL, last_error = $3,
            available_at = now() + ($4 * interval '1 minute'), updated_at = now()
      WHERE id = $1`,
    [job.id, terminal ? "dead" : "retry", message.slice(0, 1000), merchDiscountRetryDelayMinutes(job.attempts)]
  );
  console.error(`Merch discount sync ${job.id} ${terminal ? "dead" : "retry"}: ${message}`);
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
  await getPool().query(
    `UPDATE merch_discount_sync_jobs
        SET status = CASE WHEN attempts >= $1 THEN 'dead' ELSE 'retry' END,
            locked_at = NULL, available_at = now(),
            last_error = COALESCE(last_error, 'Worker lock expired'), updated_at = now()
      WHERE status = 'processing' AND locked_at < now() - interval '15 minutes'`,
    [MERCH_DISCOUNT_SYNC_MAX_ATTEMPTS]
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
  const merchDiscountJob = await claimMerchDiscountSyncJob();
  if (merchDiscountJob) {
    worked = true;
    try {
      await deliverMerchDiscountSync(merchDiscountJob);
    } catch (error) {
      await failMerchDiscountSync(merchDiscountJob, error);
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
