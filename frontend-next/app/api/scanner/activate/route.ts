import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPool } from "../../../../lib/db";
import { assertSameOrigin } from "../../../../lib/request";
import {
  SCANNER_SESSION_COOKIE,
  scannerCookieOptions,
  scannerDeviceLabel,
  scannerSessionExpiry
} from "../../../../lib/scanner-access";
import { randomToken, sha256 } from "../../../../lib/security";

type EnrolmentRow = {
  id: string;
  event_id: string;
  event_title: string;
  ends_at: Date;
  max_devices: number;
  relink_session_id: string | null;
};

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const body = await request.json() as { token?: unknown; label?: unknown; mode?: unknown };
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (token.length < 32 || token.length > 200) {
      return NextResponse.json({ error: "That scanner QR is invalid." }, { status: 400 });
    }

    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const enrolmentResult = await client.query<EnrolmentRow>(
        `SELECT se.id, se.event_id, se.max_devices, se.relink_session_id,
                e.title AS event_title, e.ends_at
           FROM scanner_enrolments se
           JOIN events e ON e.id = se.event_id
          WHERE se.token_hash = $1
            AND se.closed_at IS NULL
            AND se.expires_at > now()
            AND e.status <> 'cancelled'
          FOR UPDATE OF se`,
        [sha256(token)]
      );
      const enrolment = enrolmentResult.rows[0];
      if (!enrolment) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "That scanner QR has expired or been closed." }, { status: 410 });
      }
      if (body.mode === "relink" && !enrolment.relink_session_id) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "That QR is for enrolling a new scanner, not relinking a device." }, { status: 400 });
      }

      const sessionExpiresAt = scannerSessionExpiry(new Date(enrolment.ends_at));
      if (sessionExpiresAt.getTime() <= Date.now()) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Scanner access for this event has ended." }, { status: 410 });
      }

      const sessionToken = randomToken();
      const userAgent = request.headers.get("user-agent")?.slice(0, 300) || null;
      let label: string;

      if (enrolment.relink_session_id) {
        const relinkResult = await client.query<{ device_label: string }>(
          `UPDATE scanner_sessions
              SET token_hash = $2,
                  user_agent = $3,
                  expires_at = $4,
                  last_seen_at = now(),
                  revoked_at = NULL,
                  revoked_by = NULL
            WHERE id = $1 AND event_id = $5
          RETURNING device_label`,
          [
            enrolment.relink_session_id,
            sha256(sessionToken),
            userAgent,
            sessionExpiresAt,
            enrolment.event_id
          ]
        );
        const relinkedDevice = relinkResult.rows[0];
        if (!relinkedDevice) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: "That scanner device is no longer available to relink." }, { status: 410 });
        }
        label = relinkedDevice.device_label;
        await client.query("UPDATE scanner_enrolments SET closed_at = now() WHERE id = $1", [enrolment.id]);
      } else {
        const countResult = await client.query<{ active_count: string; total_count: string }>(
          `SELECT
             count(*) FILTER (WHERE revoked_at IS NULL AND expires_at > now())::text AS active_count,
             count(*)::text AS total_count
           FROM scanner_sessions
           WHERE enrolment_id = $1`,
          [enrolment.id]
        );
        const activeCount = Number(countResult.rows[0]?.active_count || 0);
        const totalCount = Number(countResult.rows[0]?.total_count || 0);
        if (activeCount >= enrolment.max_devices) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: "The maximum number of scanner devices is already active." }, { status: 409 });
        }

        const sessionId = randomUUID();
        label = scannerDeviceLabel(body.label, totalCount + 1);
        await client.query(
          `INSERT INTO scanner_sessions (
             id, enrolment_id, event_id, token_hash, device_label, user_agent, expires_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [sessionId, enrolment.id, enrolment.event_id, sha256(sessionToken), label, userAgent, sessionExpiresAt]
        );
      }
      await client.query("COMMIT");

      const response = NextResponse.json({
        ok: true,
        eventTitle: enrolment.event_title,
        deviceLabel: label,
        relinked: Boolean(enrolment.relink_session_id),
        expiresAt: sessionExpiresAt.toISOString()
      });
      response.cookies.set(SCANNER_SESSION_COOKIE, sessionToken, scannerCookieOptions(sessionExpiresAt));
      return response;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid request origin") {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
    console.error("Scanner activation failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Scanner access could not be activated." }, { status: 500 });
  }
}
