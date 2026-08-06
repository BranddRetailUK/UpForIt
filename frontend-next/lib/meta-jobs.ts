import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { MetaConversionInput, MetaSendResult } from "./meta-conversion";
import { encryptJson } from "./security";

type Queryable = Pick<PoolClient, "query">;

export type MetaJobInput = MetaConversionInput & {
  eventName: "InitiateCheckout" | "Purchase";
};

export const META_JOB_MAX_ATTEMPTS = 8;

export function shouldQueueTicketPurchase(
  source: "stripe" | "admin_simulation",
  consentGranted: boolean
) {
  return source === "stripe" && consentGranted;
}

export function metaRetryDelayMinutes(attempts: number) {
  return Math.min(60, 2 ** Math.max(0, attempts - 1));
}

export function metaDeliveryDecision(result: MetaSendResult, attempts: number) {
  if (result.sent) return { status: "delivered" as const };
  if (result.reason === "invalid_event" || attempts >= META_JOB_MAX_ATTEMPTS) {
    return { status: "dead" as const };
  }
  const retryableStatus = result.status === undefined || result.status === 408 || result.status === 429 || result.status >= 500;
  if (result.reason === "not_configured" || retryableStatus) {
    return { status: "retry" as const, delayMinutes: metaRetryDelayMinutes(attempts) };
  }
  return { status: "dead" as const };
}

export function metaDeliveryError(result: MetaSendResult) {
  const status = result.status ? ` (HTTP ${result.status})` : "";
  return `${result.reason || "delivery_failed"}${status}`;
}

export async function insertMetaConversionJob(
  database: Queryable,
  input: MetaJobInput,
  references: { orderId?: string } = {}
) {
  const result = await database.query(
    `INSERT INTO meta_conversion_jobs (id, order_id, event_name, event_id, encrypted_payload)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (event_id) DO NOTHING
     RETURNING id`,
    [
      randomUUID(),
      references.orderId ?? null,
      input.eventName,
      input.eventId,
      encryptJson(input)
    ]
  );
  return Boolean(result.rowCount);
}
