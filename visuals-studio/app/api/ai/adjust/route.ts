import type { NextRequest } from "next/server";
import { adjustJobWithCodex } from "@/lib/ai";
import type { VisualJobV1 } from "@/lib/contracts";
import { assertLocalRequest, apiError } from "@/lib/security";
import { validateVisualJob } from "@/lib/validation";

export const maxDuration = 150;

export async function POST(request: NextRequest) {
  try {
    assertLocalRequest(request, true);
    const body = (await request.json()) as { job?: VisualJobV1; prompt?: string };
    const job = validateVisualJob(body.job);
    return Response.json(await adjustJobWithCodex(job, String(body.prompt || "")));
  } catch (error) {
    return apiError(error);
  }
}
