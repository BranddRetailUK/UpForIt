import type { NextRequest } from "next/server";
import { assertLocalRequest, apiError } from "@/lib/security";
import { getSystemStatus } from "@/lib/system";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    assertLocalRequest(request);
    return Response.json(await getSystemStatus(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, 403);
  }
}
