import type { PoolClient } from 'pg';
import { describeEmailDeliveryError, EMAIL_JOB_MAX_ATTEMPTS } from './email-delivery';

// Wrap only failures thrown by the provider call. Database errors after acceptance
// must never be mistaken for a rejected submission, even if they have a code.
export class RejectedEmailSubmission extends Error {
  constructor(public readonly retryable: boolean, cause: unknown) {
    super(describeEmailDeliveryError(cause));
  }
}
export function classifyEmailSubmissionError(error: unknown): unknown {
  const response = error as { code?: unknown; response?: { statusCode?: unknown } } | null;
  const status = response?.response?.statusCode ?? response?.code;
  // 408 and 5xx may originate at a gateway after the provider accepted the mail.
  if (response?.response && typeof status === 'number' && status >= 400 && status < 500 && status !== 408) {
    return new RejectedEmailSubmission(status === 429, error);
  }
  return error;
}
export async function recordEmailFailure(database: Pick<PoolClient, 'query'>, job: {id:string; attempts:number}, error: unknown) {
  const rejected = error instanceof RejectedEmailSubmission;
  await database.query(
    `UPDATE email_jobs SET
       status = CASE WHEN sending_at IS NULL OR $4 THEN 'failed' ELSE 'unknown' END,
       sending_at = CASE WHEN $4 THEN NULL ELSE sending_at END,
       attempts = CASE WHEN $5 THEN GREATEST(attempts,$6) ELSE attempts END,
       locked_at = NULL, last_error = $2,
       available_at = now() + ($3 * interval '1 minute'), updated_at = now()
     WHERE id = $1 AND status = 'processing'`,
    [job.id, describeEmailDeliveryError(error).slice(0,1000), Math.min(60,2 ** job.attempts), rejected,
      rejected && !error.retryable, EMAIL_JOB_MAX_ATTEMPTS]
  );
}
