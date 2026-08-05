import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "./db";
import { encryptJson } from "./security";

export type EmailJobType = "verify_email" | "reset_password" | "ticket_confirmation";

export async function enqueueEmail(
  jobType: EmailJobType,
  payload: Record<string, unknown>,
  references: { userId?: string; orderId?: string } = {}
) {
  await insertEmailJob(getPool(), jobType, payload, references);
}

type Queryable = Pick<PoolClient, "query">;

export async function insertEmailJob(
  database: Queryable,
  jobType: EmailJobType,
  payload: Record<string, unknown>,
  references: { userId?: string; orderId?: string } = {}
) {
  await database.query(
    `INSERT INTO email_jobs (id, job_type, user_id, order_id, encrypted_payload)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      randomUUID(),
      jobType,
      references.userId ?? null,
      references.orderId ?? null,
      encryptJson(payload)
    ]
  );
}
