import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { CODEX_PATH, RUNTIME_ROOT, STUDIO_ROOT } from "./constants";
import type { AiAdjustment, VisualJobV1 } from "./contracts";
import { runProcess } from "./process";
import { validateVisualJob } from "./validation";

export async function adjustJobWithCodex(job: VisualJobV1, request: string): Promise<AiAdjustment> {
  const prompt = request.trim();
  if (!prompt) throw new Error("Enter an adjustment request first.");
  if (prompt.length > 1_000) throw new Error("AI adjustment requests are limited to 1,000 characters.");

  const aiRoot = path.join(RUNTIME_ROOT, "ai");
  await mkdir(aiRoot, { recursive: true });
  const outputPath = path.join(aiRoot, `${randomUUID()}.json`);
  const schemaPath = path.join(STUDIO_ROOT, "lib", "job-schema.json");
  const instructions = [
    "You adjust a local UPFORIT After Effects visual configuration.",
    "Return the complete adjusted VisualJobV1 object and nothing else.",
    "You may change only brand.logoAssetId, content.textAnimation when artist_batch, and motion fields including stylePreset.",
    "Never change id, name, canvas, content kind, artist names, layouts, uppercase, render fields, preset or seamlessLoop.",
    "Do not attempt to write files, execute code, or add properties.",
    `Current job:\n${JSON.stringify(job, null, 2)}`,
    `Requested adjustment:\n${prompt}`
  ].join("\n\n");

  await runProcess(
    CODEX_PATH,
    [
      "exec", "--ephemeral", "--sandbox", "read-only", "-a", "never",
      "--output-schema", schemaPath, "--output-last-message", outputPath, "-C", STUDIO_ROOT,
      instructions
    ],
    { cwd: STUDIO_ROOT, timeoutMs: 120_000 }
  );

  try {
    const adjusted = validateVisualJob(JSON.parse(await readFile(outputPath, "utf8")));
    return diffAiAdjustment(job, adjusted, prompt);
  } finally {
    await unlink(outputPath).catch(() => undefined);
  }
}

export function diffAiAdjustment(job: VisualJobV1, adjusted: VisualJobV1, summary: string): AiAdjustment {
  if (adjusted.id !== job.id || adjusted.name !== job.name) throw new Error("Codex changed immutable job identity fields.");
  if (JSON.stringify(adjusted.canvas) !== JSON.stringify(job.canvas)) throw new Error("Codex changed immutable canvas fields.");
  if (adjusted.content.kind !== job.content.kind) throw new Error("Codex changed the immutable content kind.");
  if (job.content.kind === "artist_batch" && adjusted.content.kind === "artist_batch") {
    if (JSON.stringify(adjusted.content.names) !== JSON.stringify(job.content.names)) throw new Error("Codex changed artist names.");
    if (JSON.stringify(adjusted.content.layouts) !== JSON.stringify(job.content.layouts)) throw new Error("Codex changed artist layouts.");
  }
  if (JSON.stringify(adjusted.render) !== JSON.stringify(job.render)) throw new Error("Codex changed immutable render fields.");

  return {
    summary,
    patch: {
      brand: adjusted.brand.logoAssetId === job.brand.logoAssetId ? undefined : { logoAssetId: adjusted.brand.logoAssetId },
      textAnimation:
        job.content.kind === "artist_batch" && adjusted.content.kind === "artist_batch" &&
        adjusted.content.textAnimation !== job.content.textAnimation
          ? adjusted.content.textAnimation
          : undefined,
      motion: Object.fromEntries(
        Object.entries(adjusted.motion).filter(([key, value]) => value !== job.motion[key as keyof typeof job.motion])
      ) as AiAdjustment["patch"]["motion"]
    }
  };
}
