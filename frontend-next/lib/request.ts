import type { NextRequest } from "next/server";

export function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || request.headers.get("sec-fetch-site") === "cross-site") throw new Error("Invalid request origin");
  const expected = process.env.NODE_ENV === "production" ? process.env.NEXT_PUBLIC_SITE_URL : `${request.nextUrl.protocol}//${request.headers.get("host") || request.nextUrl.host}`;
  try {
    if (!expected || new URL(origin).origin !== new URL(expected).origin) throw new Error();
  } catch { throw new Error("Invalid request origin"); }
}

export function requestIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

