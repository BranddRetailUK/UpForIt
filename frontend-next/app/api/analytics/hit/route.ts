import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPool } from "../../../../lib/db";
import { consumeRateLimit } from "../../../../lib/auth";
import { assertSameOrigin, requestIp } from "../../../../lib/request";
import { META_CONSENT_COOKIE } from "../../../../lib/meta-shared";
import { SESSION_COOKIE, VISITOR_COOKIE, trackingPath, validTrackingId } from "../../../../lib/site-analytics";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try { assertSameOrigin(request); } catch { return new NextResponse(null, { status: 403 }); }
  const empty = () => new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  if (request.cookies.get(META_CONSENT_COOKIE)?.value !== "granted") return empty();
  if (/bot|crawl|spider|headless|preview|curl|wget/i.test(request.headers.get("user-agent") || "bot") ||
      /prefetch/i.test((request.headers.get("purpose") || "") + (request.headers.get("sec-purpose") || "")) || request.headers.get("next-router-prefetch") === "1") return empty();
  try {
    if (Number(request.headers.get("content-length")) > 1024) return new NextResponse(null, { status: 413 });
    const raw = await request.text();
    if (raw.length > 1024) return new NextResponse(null, { status: 413 });
    let body; try { body = JSON.parse(raw); } catch { return new NextResponse(null, { status: 400 }); }
    const path = trackingPath(body?.path);
    if (!path || !validTrackingId(body?.id)) return new NextResponse(null, { status: 400 });
    if (!await consumeRateLimit(`site-hit:${requestIp(request)}`, 240, 5)) return new NextResponse(null, { status: 429 });
    const visitor = request.cookies.get(VISITOR_COOKIE)?.value, session = request.cookies.get(SESSION_COOKIE)?.value;
    const visitorId = validTrackingId(visitor) ? visitor : randomUUID();
    const sessionId = validTrackingId(session) ? session : randomUUID();
    await getPool().query(`INSERT INTO site_page_hits(id,visitor_id,session_id,path) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING`, [body.id, visitorId, sessionId, path]);
    const response = empty();
    const options = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };
    response.cookies.set(VISITOR_COOKIE, visitorId, { ...options, maxAge: 365 * 86400 });
    response.cookies.set(SESSION_COOKIE, sessionId, { ...options, maxAge: 60 });
    return response;
  } catch { return new NextResponse(null, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
