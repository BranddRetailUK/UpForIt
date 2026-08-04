import "server-only";

import { createHash } from "node:crypto";
import { getPool } from "./db";

const RATE_LIMIT_WINDOW_MINUTES = 10;
const MAX_NEW_CHECKOUTS_PER_WINDOW = 8;

export class MerchCheckoutGuardError extends Error {
  status: number;
  retryAfterSeconds?: number;

  constructor(message: string, status: number, retryAfterSeconds?: number) {
    super(message);
    this.name = "MerchCheckoutGuardError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function buildCheckoutRequestHash(items: Array<{ variantId: string; quantity: number }>) {
  return digest(items
    .map((item) => `${String(item.variantId)}:${Math.trunc(Number(item.quantity))}`)
    .sort()
    .join("|"));
}

export function getCheckoutRequesterKey(headers: Headers) {
  const forwardedFor = String(headers.get("x-forwarded-for") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const forwarded = String(
    forwardedFor[forwardedFor.length - 1] ||
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    "unknown"
  ).trim();
  const userAgent = String(headers.get("user-agent") || "unknown").slice(0, 240);
  const secretSalt = String(process.env.STANDALONE_STOREFRONT_UPFORIT_SECRET || "").trim();
  if (!secretSalt) throw new MerchCheckoutGuardError("Secure checkout is not configured", 503);
  return digest(`${secretSalt}:${forwarded}:${userAgent}`);
}

export async function reserveCheckoutAttempt({
  idempotencyKey,
  requestHash,
  requesterKey
}: {
  idempotencyKey: string;
  requestHash: string;
  requesterKey: string;
}) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS merch_checkout_requests (
        idempotency_key TEXT PRIMARY KEY,
        request_hash TEXT NOT NULL,
        requester_hash TEXT NOT NULL,
        attempt_count INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_merch_checkout_requests_requester_created
      ON merch_checkout_requests(requester_hash, created_at DESC)
    `);
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [requesterKey]);

    const existing = await client.query(
      "SELECT request_hash FROM merch_checkout_requests WHERE idempotency_key = $1 LIMIT 1",
      [idempotencyKey]
    );
    if (existing.rowCount) {
      if (String(existing.rows[0].request_hash) !== requestHash) {
        throw new MerchCheckoutGuardError("Checkout intent does not match this cart", 409);
      }
      await client.query(
        "UPDATE merch_checkout_requests SET attempt_count = attempt_count + 1, last_attempt_at = NOW() WHERE idempotency_key = $1",
        [idempotencyKey]
      );
      await client.query("COMMIT");
      return { reused: true };
    }

    const recent = await client.query(
      `
        SELECT COUNT(*)::int AS count
        FROM merch_checkout_requests
        WHERE requester_hash = $1
          AND created_at >= NOW() - make_interval(mins => $2::int)
      `,
      [requesterKey, RATE_LIMIT_WINDOW_MINUTES]
    );
    if (Number(recent.rows[0]?.count || 0) >= MAX_NEW_CHECKOUTS_PER_WINDOW) {
      throw new MerchCheckoutGuardError(
        "Too many checkout attempts. Please wait a few minutes and try again.",
        429,
        RATE_LIMIT_WINDOW_MINUTES * 60
      );
    }

    await client.query(
      `
        INSERT INTO merch_checkout_requests (
          idempotency_key, request_hash, requester_hash, created_at, last_attempt_at
        ) VALUES ($1, $2, $3, NOW(), NOW())
      `,
      [idempotencyKey, requestHash, requesterKey]
    );
    await client.query(
      "DELETE FROM merch_checkout_requests WHERE last_attempt_at < NOW() - INTERVAL '7 days'"
    );
    await client.query("COMMIT");
    return { reused: false };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    if (error instanceof MerchCheckoutGuardError) throw error;
    console.error("[merch-checkout-guard]", error);
    throw new MerchCheckoutGuardError("Secure checkout is temporarily unavailable", 503);
  } finally {
    client.release();
  }
}
