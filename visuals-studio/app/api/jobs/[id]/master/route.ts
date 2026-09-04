import type { NextRequest } from "next/server";
import { assertJobId, readJob } from "@/lib/jobs";
import { runMaster } from "@/lib/orchestrator";
import { assertLocalRequest, apiError } from "@/lib/security";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertLocalRequest(request, true);
    const { id } = await context.params;
    assertJobId(id);
    await readJob(id);
    void runMaster(id).catch((error) => console.error("Master render failed", error));
    return Response.json({ accepted: true, jobId: id }, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}
