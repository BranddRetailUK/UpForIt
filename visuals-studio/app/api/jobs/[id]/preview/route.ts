import type { NextRequest } from "next/server";
import { assertJobId, readJob } from "@/lib/jobs";
import { runPreview } from "@/lib/orchestrator";
import { assertLocalRequest, apiError } from "@/lib/security";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertLocalRequest(request, true);
    const { id } = await context.params;
    assertJobId(id);
    await readJob(id);
    void runPreview(id).catch((error) => console.error("Preview failed", error));
    return Response.json({ accepted: true, jobId: id }, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}
