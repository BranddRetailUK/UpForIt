import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { assertJobId, jobDirectory, readJob } from "@/lib/jobs";
import { assertLocalRequest, apiError } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertLocalRequest(request);
    const { id } = await context.params;
    assertJobId(id);
    await readJob(id);
    const logsRoot = path.join(/* turbopackIgnore: true */ jobDirectory(id), "logs");
    const filenames = (await readdir(/* turbopackIgnore: true */ logsRoot).catch(() => []))
      .filter((filename) => filename.endsWith(".log"))
      .sort();
    const sections = await Promise.all(filenames.map(async (filename) => {
      const contents = await readFile(/* turbopackIgnore: true */ path.join(logsRoot, filename), "utf8");
      return `— ${filename} —\n${contents.slice(-60_000)}`;
    }));
    return Response.json(
      { files: filenames, text: sections.join("\n\n") },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return apiError(error, 404);
  }
}
