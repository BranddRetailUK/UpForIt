import type { NextRequest } from "next/server";
import { deleteJob } from "@/lib/jobs";
import { assertLocalRequest, apiError } from "@/lib/security";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertLocalRequest(request, true);
    const { id } = await context.params;
    await deleteJob(id);
    return Response.json({ deleted: true, id });
  } catch (error) {
    return apiError(error);
  }
}
