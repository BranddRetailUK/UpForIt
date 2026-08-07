import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { getPool } from "./db";

export const TICKET_MERCH_DISCOUNT_CAMPAIGN = "ticket-merch-20";
export const TICKET_MERCH_DISCOUNT_PERCENT = 20;
export const MERCH_DISCOUNT_SYNC_MAX_ATTEMPTS = 10;

type Queryable = Pick<Pool | PoolClient, "query">;

export type MerchDiscountEntitlement = {
  id: string;
  userId: string;
  sourceTicketOrderId: string;
  status: "available" | "reserved" | "redeemed" | "revoked";
  percentOff: number;
  checkoutIdempotencyKey: string | null;
  stripeCheckoutSessionId: string | null;
};

type EntitlementRow = {
  id: string;
  user_id: string;
  source_ticket_order_id: string;
  status: MerchDiscountEntitlement["status"];
  percent_off: number;
  checkout_idempotency_key: string | null;
  stripe_checkout_session_id: string | null;
};

function toEntitlement(row: EntitlementRow): MerchDiscountEntitlement {
  return {
    id: row.id,
    userId: row.user_id,
    sourceTicketOrderId: row.source_ticket_order_id,
    status: row.status,
    percentOff: Number(row.percent_off),
    checkoutIdempotencyKey: row.checkout_idempotency_key,
    stripeCheckoutSessionId: row.stripe_checkout_session_id
  };
}

export function calculateTicketMerchDiscountMinor(subtotalMinor: number) {
  return Math.max(0, Math.round(Math.max(0, Math.trunc(subtotalMinor)) * TICKET_MERCH_DISCOUNT_PERCENT / 100));
}

export async function grantTicketMerchDiscount(
  database: Queryable,
  input: { userId: string; ticketOrderId: string; source: "stripe" | "admin_simulation" }
) {
  if (input.source !== "stripe") return false;
  const result = await database.query(
    `INSERT INTO merch_discount_entitlements (
       id, user_id, source_ticket_order_id, campaign, percent_off, status
     ) VALUES ($1, $2, $3, $4, $5, 'available')
     ON CONFLICT (user_id) DO NOTHING
     RETURNING id`,
    [
      randomUUID(),
      input.userId,
      input.ticketOrderId,
      TICKET_MERCH_DISCOUNT_CAMPAIGN,
      TICKET_MERCH_DISCOUNT_PERCENT
    ]
  );
  return Boolean(result.rowCount);
}

export async function getUsableMerchDiscount(userId: string, database: Queryable = getPool()) {
  const result = await database.query<EntitlementRow>(
    `SELECT id, user_id, source_ticket_order_id, status, percent_off,
            checkout_idempotency_key, stripe_checkout_session_id
       FROM merch_discount_entitlements
      WHERE user_id = $1 AND status IN ('available', 'reserved')
      LIMIT 1`,
    [userId]
  );
  return result.rows[0] ? toEntitlement(result.rows[0]) : null;
}

export async function getMerchDiscountEntitlement(userId: string, database: Queryable = getPool()) {
  const result = await database.query<EntitlementRow>(
    `SELECT id, user_id, source_ticket_order_id, status, percent_off,
            checkout_idempotency_key, stripe_checkout_session_id
       FROM merch_discount_entitlements
      WHERE user_id = $1
      LIMIT 1`,
    [userId]
  );
  return result.rows[0] ? toEntitlement(result.rows[0]) : null;
}

export async function markMerchDiscountReserved(input: {
  entitlementId: string;
  userId: string;
  idempotencyKey: string;
  checkoutSessionId: string;
}) {
  const result = await getPool().query<EntitlementRow>(
    `UPDATE merch_discount_entitlements
        SET status = 'reserved', checkout_idempotency_key = $3,
            stripe_checkout_session_id = $4, reserved_at = now(), updated_at = now()
      WHERE id = $1 AND user_id = $2 AND status IN ('available', 'reserved')
      RETURNING id, user_id, source_ticket_order_id, status, percent_off,
                checkout_idempotency_key, stripe_checkout_session_id`,
    [input.entitlementId, input.userId, input.idempotencyKey, input.checkoutSessionId]
  );
  if (!result.rows[0]) throw new Error("Merch discount is no longer available");
  await enqueueMerchDiscountSyncJob(getPool(), {
    entitlementId: input.entitlementId,
    action: "reconcile",
    eventKey: `reconcile:${input.checkoutSessionId}`,
    checkoutSessionId: input.checkoutSessionId
  });
  return toEntitlement(result.rows[0]);
}

export async function reconcileMerchDiscountFromConfirmation(input: {
  entitlementId?: string | null;
  checkoutSessionId: string;
  paid: boolean;
  status: string;
}) {
  if (!input.entitlementId) return;
  const normalizedStatus = String(input.status || "").toLowerCase();
  if (input.paid || normalizedStatus === "processed") {
    await getPool().query(
      `UPDATE merch_discount_entitlements
          SET status = 'redeemed', redeemed_at = COALESCE(redeemed_at, now()), updated_at = now()
        WHERE id = $1 AND stripe_checkout_session_id = $2 AND status <> 'redeemed'`,
      [input.entitlementId, input.checkoutSessionId]
    );
    return;
  }
  if (["expired", "payment_failed", "failed"].includes(normalizedStatus)) {
    await getPool().query(
      `UPDATE merch_discount_entitlements
          SET status = 'available', checkout_idempotency_key = NULL,
              stripe_checkout_session_id = NULL, reserved_at = NULL, updated_at = now()
        WHERE id = $1 AND stripe_checkout_session_id = $2 AND status = 'reserved'`,
      [input.entitlementId, input.checkoutSessionId]
    );
  }
}

export async function revokeUnusedMerchDiscountForTicketOrder(
  database: Queryable,
  ticketOrderId: string
) {
  const result = await database.query<{ id: string; stripe_checkout_session_id: string | null }>(
    `UPDATE merch_discount_entitlements
        SET status = 'revoked', revoked_at = COALESCE(revoked_at, now()), updated_at = now()
      WHERE source_ticket_order_id = $1 AND status IN ('available', 'reserved')
      RETURNING id, stripe_checkout_session_id`,
    [ticketOrderId]
  );
  const revoked = result.rows[0];
  if (revoked) {
    await enqueueMerchDiscountSyncJob(database, {
      entitlementId: revoked.id,
      action: "revoke",
      eventKey: `revoke:${revoked.id}`,
      checkoutSessionId: revoked.stripe_checkout_session_id
    });
  }
  return revoked ?? null;
}

export async function enqueueMerchDiscountSyncJob(
  database: Queryable,
  input: {
    entitlementId: string;
    action: "reconcile" | "revoke";
    eventKey: string;
    checkoutSessionId?: string | null;
  }
) {
  const result = await database.query(
    `INSERT INTO merch_discount_sync_jobs (
       id, entitlement_id, action, event_key, stripe_checkout_session_id
     ) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (event_key) DO NOTHING
     RETURNING id`,
    [randomUUID(), input.entitlementId, input.action, input.eventKey, input.checkoutSessionId ?? null]
  );
  return Boolean(result.rowCount);
}

export function merchDiscountRetryDelayMinutes(attempts: number) {
  return Math.min(30, 2 ** Math.max(0, attempts - 1));
}
