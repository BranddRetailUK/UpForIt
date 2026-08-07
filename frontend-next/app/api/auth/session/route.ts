import { NextRequest, NextResponse } from "next/server";
import {
  getUserForSessionToken,
  SESSION_COOKIE
} from "../../../../lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getUserForSessionToken(
    request.cookies.get(SESSION_COOKIE)?.value
  );
  return NextResponse.json(
    { accountId: user?.id ?? null },
    { headers: { "cache-control": "private, no-store" } }
  );
}
