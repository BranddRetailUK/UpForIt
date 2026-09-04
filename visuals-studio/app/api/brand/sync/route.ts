import type { NextRequest } from "next/server";
import { syncBrandAssets } from "@/lib/brand";
import { assertLocalRequest, apiError } from "@/lib/security";

export async function POST(request: NextRequest) {
  try {
    assertLocalRequest(request, true);
    return Response.json({ assets: await syncBrandAssets() });
  } catch (error) {
    return apiError(error);
  }
}
