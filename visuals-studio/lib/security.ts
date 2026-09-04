import { randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

const processSecurity = globalThis as typeof globalThis & {
  __upforitVisualsCsrfToken?: string;
};
const csrfToken = processSecurity.__upforitVisualsCsrfToken ||= randomBytes(32).toString("hex");

export function getCsrfToken() {
  return csrfToken;
}

export function isLoopbackHost(host: string) {
  const normalized = host.trim().toLowerCase();
  return /^(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(normalized) || /^\[::1\](?::\d+)?$/.test(normalized);
}

function secureEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function assertLocalRequest(request: NextRequest, mutation = false) {
  const host = request.headers.get("host") || "";
  if (!isLoopbackHost(host)) throw new Error("Visuals Studio accepts loopback requests only.");

  if (mutation) {
    const origin = request.headers.get("origin");
    if (!origin) throw new Error("A same-origin request is required.");
    const originHost = new URL(origin).host.toLowerCase();
    if (originHost !== host.toLowerCase() || !isLoopbackHost(originHost)) throw new Error("Cross-origin requests are blocked.");
    const suppliedToken = request.headers.get("x-upforit-csrf") || "";
    if (!secureEqual(suppliedToken, csrfToken)) throw new Error("Invalid Visuals Studio session token.");
  }
}

export function apiError(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "Unexpected Visuals Studio error.";
  return Response.json({ error: message }, { status });
}
