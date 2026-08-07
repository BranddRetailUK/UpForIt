import type { NextRequest } from "next/server";
import { getUserForSessionToken, SESSION_COOKIE } from "./auth";
import { getPool } from "./db";
import { SCANNER_SESSION_COOKIE } from "./scanner-access";
import { sha256 } from "./security";

export type CheckInPrincipal = {
  userId: string | null;
  scannerSessionId: string | null;
  eventId: string | null;
  eventTitle: string | null;
  deviceLabel: string | null;
};

type ScannerSessionRow = {
  id: string;
  event_id: string;
  event_title: string;
  device_label: string;
  expires_at: Date;
};

export async function getScannerSessionForToken(token?: string | null, touch = false) {
  if (!token) return null;
  const result = await getPool().query<ScannerSessionRow>(
    `SELECT ss.id, ss.event_id, ss.device_label, ss.expires_at, e.title AS event_title
       FROM scanner_sessions ss
       JOIN events e ON e.id = ss.event_id
      WHERE ss.token_hash = $1
        AND ss.revoked_at IS NULL
        AND ss.expires_at > now()
        AND e.status <> 'cancelled'
        AND e.ends_at + interval '2 hours' > now()`,
    [sha256(token)]
  );
  const session = result.rows[0];
  if (!session) return null;
  if (touch) {
    await getPool().query("UPDATE scanner_sessions SET last_seen_at = now() WHERE id = $1", [session.id]);
  }
  return session;
}

export async function getCheckInPrincipal(request: NextRequest): Promise<CheckInPrincipal | null> {
  const user = await getUserForSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (user?.role === "admin") {
    return {
      userId: user.id,
      scannerSessionId: null,
      eventId: null,
      eventTitle: null,
      deviceLabel: user.displayName
    };
  }

  const session = await getScannerSessionForToken(
    request.cookies.get(SCANNER_SESSION_COOKIE)?.value,
    true
  );
  return session ? {
    userId: null,
    scannerSessionId: session.id,
    eventId: session.event_id,
    eventTitle: session.event_title,
    deviceLabel: session.device_label
  } : null;
}
