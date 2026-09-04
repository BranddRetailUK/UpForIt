import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isLoopbackHost } from "@/lib/security";

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") || "";
  if (!isLoopbackHost(host)) {
    return Response.json({ error: "Visuals Studio accepts loopback requests only." }, { status: 403 });
  }

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const originHost = new URL(origin).host.toLowerCase();
      if (!isLoopbackHost(originHost) || originHost !== host.toLowerCase()) {
        return Response.json({ error: "Cross-origin requests are blocked." }, { status: 403 });
      }
    } catch {
      return Response.json({ error: "Invalid Origin header." }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
