import type { NextRequest } from "next/server";
import { assertJobId } from "@/lib/jobs";
import { revealJob } from "@/lib/orchestrator";
import { assertLocalRequest, apiError } from "@/lib/security";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertLocalRequest(request, true);
    const { id } = await context.params;
    assertJobId(id);
    const body = (await request.json().catch(() => ({}))) as { target?: "project" | "folder" };
    await revealJob(id, body.target === "project" ? "project" : "folder");
    return Response.json({ opened: true });
  } catch (error) {
    return apiError(error);
  }
}
