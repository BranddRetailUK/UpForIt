import type { NextRequest } from "next/server";
import type { VisualJobV1 } from "@/lib/contracts";
import { parseArtistNames } from "@/lib/artists";
import { createJob, listJobs } from "@/lib/jobs";
import { assertLocalRequest, apiError } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    assertLocalRequest(request);
    return Response.json({ jobs: await listJobs() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, 403);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertLocalRequest(request, true);
    const body = (await request.json()) as Omit<VisualJobV1, "id">;
    if (body.content?.kind === "artist_batch") {
      body.content.names = parseArtistNames(body.content.names);
      if (!body.content.names.length) throw new Error("Add at least one artist name.");
    }
    return Response.json({ job: await createJob(body) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
