import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getAdminForRequest } from "../../../../lib/admin-auth";
import { getPool } from "../../../../lib/db";
import { assertSameOrigin } from "../../../../lib/request";
import {
  SCANNER_ENROLMENT_MINUTES,
  SCANNER_MAX_DEVICES,
  scannerSessionExpiry
} from "../../../../lib/scanner-access";
import { randomToken, sha256 } from "../../../../lib/security";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DeviceRow = {
  id: string;
  event_id: string;
  event_title: string;
  device_label: string;
  user_agent: string | null;
  expires_at: Date;
  last_seen_at: Date;
  revoked_at: Date | null;
  created_at: Date;
  scan_count: string;
};

export async function GET(request: NextRequest) {
  const admin = await getAdminForRequest(request);
  if (!admin) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

  const result = await getPool().query<DeviceRow>(
    `SELECT ss.id, ss.event_id, e.title AS event_title, ss.device_label, ss.user_agent,
            ss.expires_at, ss.last_seen_at, ss.revoked_at, ss.created_at,
            count(a.id)::text AS scan_count
       FROM scanner_sessions ss
       JOIN events e ON e.id = ss.event_id
       LEFT JOIN ticket_audit_log a
         ON a.scanner_session_id = ss.id AND a.action = 'checked_in'
      GROUP BY ss.id, e.title
      ORDER BY ss.created_at DESC
      LIMIT 100`
  );
  return NextResponse.json({ devices: result.rows });
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const admin = await getAdminForRequest(request);
    if (!admin) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

    const body = await request.json() as { eventId?: unknown };
    const eventId = typeof body.eventId === "string" ? body.eventId : "";
    if (!UUID_PATTERN.test(eventId)) {
      return NextResponse.json({ error: "Choose a valid event." }, { status: 400 });
    }

    const eventResult = await getPool().query<{ title: string; ends_at: Date }>(
      "SELECT title, ends_at FROM events WHERE id = $1 AND status <> 'cancelled'",
      [eventId]
    );
    const selectedEvent = eventResult.rows[0];
    if (!selectedEvent) return NextResponse.json({ error: "Event not found." }, { status: 404 });

    const sessionExpiresAt = scannerSessionExpiry(new Date(selectedEvent.ends_at));
    if (sessionExpiresAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: "Scanner access for this event has ended." }, { status: 409 });
    }

    const enrolmentToken = randomToken();
    const enrolmentId = randomUUID();
    const enrolmentExpiresAt = new Date(Date.now() + SCANNER_ENROLMENT_MINUTES * 60 * 1000);
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE scanner_enrolments
            SET closed_at = now()
          WHERE event_id = $1 AND closed_at IS NULL AND expires_at > now()`,
        [eventId]
      );
      await client.query(
        `INSERT INTO scanner_enrolments (
           id, event_id, created_by, token_hash, expires_at, max_devices
         ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [enrolmentId, eventId, admin.id, sha256(enrolmentToken), enrolmentExpiresAt, SCANNER_MAX_DEVICES]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) throw new Error("NEXT_PUBLIC_SITE_URL is not set");
    const activationUrl = new URL("/scan/activate", siteUrl);
    activationUrl.hash = `token=${encodeURIComponent(enrolmentToken)}`;
    const qrDataUrl = await QRCode.toDataURL(activationUrl.toString(), {
      width: 720,
      margin: 2,
      errorCorrectionLevel: "M"
    });

    return NextResponse.json({
      ok: true,
      eventId,
      eventTitle: selectedEvent.title,
      enrolmentId,
      enrolmentExpiresAt: enrolmentExpiresAt.toISOString(),
      sessionExpiresAt: sessionExpiresAt.toISOString(),
      qrDataUrl
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid request origin") {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
    console.error("Scanner enrolment creation failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Scanner enrolment could not be created." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const admin = await getAdminForRequest(request);
    if (!admin) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    const body = await request.json() as { eventId?: unknown; action?: unknown };
    const eventId = typeof body.eventId === "string" ? body.eventId : "";
    if (!UUID_PATTERN.test(eventId) || !["close_enrolment", "revoke_all"].includes(String(body.action))) {
      return NextResponse.json({ error: "Invalid scanner access request." }, { status: 400 });
    }

    await getPool().query(
      "UPDATE scanner_enrolments SET closed_at = COALESCE(closed_at, now()) WHERE event_id = $1 AND closed_at IS NULL",
      [eventId]
    );
    if (body.action === "revoke_all") {
      await getPool().query(
        `UPDATE scanner_sessions
            SET revoked_at = now(), revoked_by = $2
          WHERE event_id = $1 AND revoked_at IS NULL AND expires_at > now()`,
        [eventId, admin.id]
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid request origin") {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
    console.error("Scanner access update failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Scanner access could not be updated." }, { status: 500 });
  }
}
