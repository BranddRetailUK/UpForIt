import type { NextRequest } from "next/server";
import { assertJobId, readJob } from "@/lib/jobs";
import { runBatchBuild } from "@/lib/orchestrator";
import { assertLocalRequest, apiError } from "@/lib/security";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertLocalRequest(request, true);
    const { id } = await context.params;
    assertJobId(id);
    const job = await readJob(id);
    if (job.content.kind !== "artist_batch") throw new Error("Only artist jobs support batch building.");
    void runBatchBuild(id).catch((error) => console.error("Batch build failed", error));
    return Response.json({ accepted: true, jobId: id }, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}
