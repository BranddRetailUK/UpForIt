import { guestDownloadToken } from "../lib/ticket-guest-access";
import { runWorkerLane } from "../lib/worker-loop";
import { classifyEmailSubmissionError, recordEmailFailure } from "../lib/email-failure";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {expireClosedTicketCheckouts} from "../lib/ticket-maintenance";
import sgMail from "@sendgrid/mail";
import QRCode from "qrcode";
import { getPool } from "../lib/db";
import {
  paymentReviewEmailHtml,
  resetPasswordEmailHtml,
  ticketConfirmationEmailHtml,
  verificationEmailHtml
} from "../lib/email-templates";
import {
  buildTicketEmailAttachments,
  describeEmailDeliveryError,
  EMAIL_JOB_MAX_ATTEMPTS,
  type SendGridAttachment
} from "../lib/email-delivery";
import { sendMetaConversion } from "../lib/meta-conversion";
import { getMerchCheckoutConfirmation, revokeGoodGameMerchDiscount, merchSyncEnabled } from "../lib/merch-api";
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
  job_type: "verify_email" | "reset_password" | "ticket_confirmation" | "ticket_payment_review";
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
        WHERE status IN ('pending', 'failed') AND available_at <= now() AND attempts < $1
        ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
     )
     UPDATE email_jobs j SET status = 'processing', locked_at = now(), attempts = attempts + 1, updated_at = now()
       FROM next_job WHERE j.id = next_job.id
     RETURNING j.id, j.job_type, j.order_id, j.encrypted_payload, j.attempts`,
    [EMAIL_JOB_MAX_ATTEMPTS]
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
  sgMail.setTimeout(30000);

  const testingRecipient = process.env.EMAIL_FORCE_RECIPIENT?.trim();
  if (process.env.APP_ENV === "production" && testingRecipient) throw new Error("EMAIL_FORCE_RECIPIENT is forbidden in production");
  const to = testingRecipient || payload.to;
  const prefix = process.env.EMAIL_SUBJECT_PREFIX?.trim() || "";
  const originalRecipient = testingRecipient ? payload.to : undefined;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.upforitevents.co.uk";
  let subject: string;
  let text: string;
  let html: string;
  let attachments: SendGridAttachment[] | undefined;
  let ticketSnapshot = "";

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
  } else if (job.job_type === "ticket_payment_review") {
    if (!payload.orderId) throw new Error("Payment review job is missing orderId");
    const guest = !(await getPool().query('SELECT user_id FROM ticket_orders WHERE id=$1',[payload.orderId])).rows[0]?.user_id;
    subject = "Your UPFORIT payment needs review";
    text = `Hi ${payload.displayName},\n\nWe received your payment, but cannot issue tickets because the event or ticket sales are unavailable. Your order is held for review. Please do not pay again. This email is not an admission ticket and does not confirm a refund.\n\n${guest ? "Contact info@upforitevents.co.uk for help with your booking." : `View your order: ${new URL(`/account/orders/${payload.orderId}`, siteUrl).toString()}`}`;
    html = paymentReviewEmailHtml({guest,displayName:payload.displayName, accountUrl:new URL(`/account/orders/${payload.orderId}`,siteUrl).toString(),siteUrl,originalRecipient});
  } else {
    if (!payload.orderId) throw new Error("Ticket confirmation job is missing orderId");
    const ticketRows = await getTicketDocumentRows(payload.orderId);
    if (!ticketRows.length) {
      await getPool().query("UPDATE email_jobs SET status='cancelled',locked_at=NULL,last_error='No available admissions' WHERE id=$1",[job.id]);
      return;
    }
    ticketSnapshot = ticketRows.map(row => row.public_id).join(",");
    const pdf = await buildTicketPdf(payload.orderId, ticketRows);
    const guest = Boolean(ticketRows[0].guest);
    const ticketUrl = guest ? new URL(`/api/tickets/orders/${payload.orderId}/pdf?guest_token=${guestDownloadToken(payload.orderId)}`,siteUrl).toString() : new URL("/account",siteUrl).toString();
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
      ? `Hi ${payload.displayName},\n\nYour UPFORIT ticket is attached as a PDF. Its unique QR code is also included in the HTML email for quick access on your phone. Keep both private and show the QR code at entry.\n\n${guest ? "Download your tickets" : "View your account"}: ${ticketUrl}`
      : `Hi ${payload.displayName},\n\nYour UPFORIT tickets are attached in one PDF, with one page and one unique QR code per admission ticket. Save the PDF to your phone and show each QR code at entry.\n\n${guest ? "Download your tickets" : "View your account"}: ${ticketUrl}`;
    html = ticketConfirmationEmailHtml({
      displayName: payload.displayName,
      accountUrl: ticketUrl,
      guest,
      siteUrl,
      originalRecipient,
      singleTicketQrCid: qrContentId,
      singleTicketNumber: singleTicket?.ticket_number,
      bannerCid: "upforit-ticket-banner"
    });
    attachments = buildTicketEmailAttachments({
      pdf,
      singleTicket: Boolean(singleTicket),
      qrImage,
      qrContentId
    });
    attachments.push({content:(await readFile(path.join(process.cwd(),"public/brand/ticket-email-banner.png"))).toString("base64"),filename:"UPFORIT-ticket-banner.png",type:"image/png",disposition:"inline",content_id:"upforit-ticket-banner"});
  }

  // The order lock serializes delivery with refunds/check-in. An in-flight provider
  // request has an uncertain outcome after a crash and must never be auto-retried.
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    if (job.job_type === "ticket_payment_review" && job.order_id) {
      const review = await client.query("SELECT id FROM ticket_orders WHERE id=$1 AND status='refund_review' AND admissions_hold=true AND payment_review_reason IS NOT NULL FOR UPDATE",[job.order_id]);
      if (!review.rowCount) {
        await client.query("UPDATE email_jobs SET status='cancelled',locked_at=NULL,last_error='Payment review resolved' WHERE id=$1",[job.id]);
        await client.query("COMMIT");
        return;
      }
    } else if (job.order_id) {
      const order = await client.query("SELECT id FROM ticket_orders WHERE id=$1 AND status IN ('paid','refund_review') AND admissions_hold=false FOR UPDATE", [job.order_id]);
      if (!order.rowCount) {
        await client.query("UPDATE email_jobs SET status='cancelled',locked_at=NULL,last_error='Admissions unavailable' WHERE id=$1",[job.id]);
        await client.query("COMMIT");
        return;
      }
      // A review may have voided a subset while the PDF was being generated.
      // Cancel that snapshot and let an explicit resend produce a fresh attachment.
      const rows = await getTicketDocumentRows(job.order_id);
      if (rows.map(row => row.public_id).join(',') !== ticketSnapshot) {
        await client.query("UPDATE email_jobs SET status='cancelled',locked_at=NULL,last_error='Admissions changed; resend current tickets' WHERE id=$1",[job.id]);
        await client.query("COMMIT");
        return;
      }
    }
    await getPool().query("UPDATE email_jobs SET sending_at=now() WHERE id=$1",[job.id]);
    const [response] = await sgMail.send({
    to,
    from: { email: fromEmail, name: process.env.SENDGRID_FROM_NAME || "UPFORIT Events" },
    replyTo: process.env.SENDGRID_REPLY_TO_EMAIL || fromEmail,
    subject: `${prefix}${prefix ? " " : ""}${subject}`,
    text,
    html,
    attachments,
    customArgs: { ticket_email_job_id: job.id },
    trackingSettings: { clickTracking: { enable: false, enableText: false } }
  }).catch(error => { throw classifyEmailSubmissionError(error); });
  await getPool().query(
    `UPDATE email_jobs SET status = CASE WHEN status IN ('delivered','bounced') THEN status ELSE 'sent' END, provider_message_id=$2, sent_at = now(), locked_at = NULL, last_error = NULL, updated_at = now()
      WHERE id = $1`,
    [job.id, response.headers["x-message-id"] ?? null]
  );
  if (job.job_type === "ticket_confirmation" && job.order_id) {
    await client.query(
      "UPDATE ticket_orders SET confirmation_email_sent_at = now(), updated_at = now() WHERE id = $1",
      [job.order_id]
    );
  }
    await client.query("COMMIT");
  } catch(error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

async function failEmail(job: Job, error: unknown) {
  const message = describeEmailDeliveryError(error);
  await recordEmailFailure(getPool(), job, error);
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
        SET status = CASE WHEN sending_at IS NULL THEN 'failed' ELSE 'unknown' END, locked_at = NULL, available_at = now(),
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

async function workOnce(lane: "email" | "meta" | "merch") {
  let worked = false;
  const emailJob = lane === "email" ? await claimEmailJob() : null;
  if (emailJob) {
    worked = true;
    try {
      await deliverEmail(emailJob);
    } catch (error) {
      await failEmail(emailJob, error);
    }
  }
  const metaJob = lane === "meta" ? await claimMetaJob() : null;
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
  const merchDiscountJob = lane === "merch" && merchSyncEnabled() ? await claimMerchDiscountSyncJob() : null;
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
  const once=process.argv.includes('--once');
  const run=(name:'email'|'meta'|'merch'|'maintenance')=>runWorkerLane({
    name,once,intervalMs:name==='maintenance'?30000:5000,
    work:async()=>{
      if(name==='maintenance'){await recoverStaleJobs();await expireClosedTicketCheckouts();return false;}
      return workOnce(name);
    },
    success:async()=>{await getPool().query("INSERT INTO ticket_worker_health(worker,heartbeat_at) VALUES($1,now()) ON CONFLICT(worker) DO UPDATE SET heartbeat_at=now(),last_error=NULL",[name]);},
    failure:async(error)=>{await getPool().query("INSERT INTO ticket_worker_health(worker,heartbeat_at,last_error,last_error_at) VALUES($1,'epoch',$2,now()) ON CONFLICT(worker) DO UPDATE SET last_error=$2,last_error_at=now()",[name,error instanceof Error?error.name:'UnknownError']);}
  });
  try {
    // Maintenance must also recover abandoned jobs in email-only deployments.
    await Promise.all(process.argv.includes('--email-only')?[run('email'),run('maintenance')]:[run('email'),run('meta'),run('merch'),run('maintenance')]);
  } finally { await getPool().end(); }
}
main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=1;});
