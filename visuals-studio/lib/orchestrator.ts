import { appendFile, copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  AE_BRIDGE_PATH,
  AERENDER_PATH,
  AFTER_EFFECTS_APP_NAME,
  AFTER_EFFECTS_PROCESS_PATTERN,
  FFMPEG_PATH
} from "./constants";
import { brandAssetPath } from "./brand";
import type { ArtistLayout, JobArtifact, StoredJob } from "./contracts";
import {
  addArtifacts,
  jobDirectory,
  readJob,
  relativeArtifactPath,
  updateJob,
  withJobLock
} from "./jobs";
import { runProcess } from "./process";
import { createSafetyReport } from "./safety";
import { getSystemStatus } from "./system";
import { validateRenderedMedia, type MediaExpectation } from "./media";

type BuildMode = "preview" | "batch" | "master";

type BridgeRenderItem = {
  sourcePath: string;
  label: string;
  artist?: string;
  layout?: ArtistLayout;
  preview: boolean;
};

type BridgeResult = {
  ok: boolean;
  error?: string;
  projectPath: string;
  outputTemplates: string[];
  renderItems: BridgeRenderItem[];
  failures: Array<{ name: string; error: string }>;
};

function artifactUrl(jobId: string, relativePath: string) {
  return `/api/jobs/${jobId}/artifacts/${relativePath.split(path.sep).map(encodeURIComponent).join("/")}`;
}

async function logLine(logPath: string, line: string) {
  await appendFile(logPath, `[${new Date().toISOString()}] ${line}\n`).catch(() => undefined);
}

async function afterEffectsProcessIsRunning() {
  try {
    const result = await runProcess("pgrep", ["-f", AFTER_EFFECTS_PROCESS_PATTERN], { timeoutMs: 3_000 });
    return Boolean(result.stdout.trim());
  } catch {
    return false;
  }
}

async function waitForAfterEffectsExit(timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await afterEffectsProcessIsRunning())) return true;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return !(await afterEffectsProcessIsRunning());
}

async function quitAfterEffects(logPath: string) {
  if (await waitForAfterEffectsExit(6_000)) return;
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!(await afterEffectsProcessIsRunning())) return;
    try {
      await runProcess(
        "/usr/bin/osascript",
        ["-e", `tell application ${JSON.stringify(AFTER_EFFECTS_APP_NAME)} to quit saving no`],
        { timeoutMs: 30_000 }
      );
    } catch (error) {
      lastError = error;
    }
    if (await waitForAfterEffectsExit(5_000)) return;
  }
  await logLine(
    logPath,
    `After Effects required manual close after bridge completion: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}

async function assertReady(job: StoredJob) {
  const system = await getSystemStatus();
  if (!system.tools.afterEffects.ready) throw new Error("After Effects 2026 is not available.");
  if (!system.tools.aerender.ready) throw new Error("aerender is not available.");
  if (!system.tools.ffmpeg.ready) throw new Error("FFmpeg is not available.");
  if (!system.scriptingPreference.ready) throw new Error(system.scriptingPreference.message);
  if (job.brand.logoAssetId !== "none" && !system.brand.ready) throw new Error("Sync the UPFORIT brand assets before rendering.");
  if (!system.disk.ready) throw new Error("At least 20 GB of free disk space is required for lossless intermediates.");
  if (job.content.kind === "artist_batch" && !system.font.ready) throw new Error(system.font.message);
  if (system.afterEffectsRunning) throw new Error("After Effects is already running. Save and close it before starting automation.");
}

async function prepareBuild(job: StoredJob, mode: BuildMode) {
  const root = jobDirectory(job.id);
  const sourceRoot = path.join(root, "source");
  const assetRoot = path.join(root, "assets");
  const projectRoot = path.join(root, "project");
  const intermediateRoot = path.join(root, "intermediate", mode);
  const logsRoot = path.join(root, "logs");
  await rm(intermediateRoot, { recursive: true, force: true });
  await Promise.all(
    [sourceRoot, assetRoot, projectRoot, intermediateRoot, logsRoot, path.join(root, "previews"), path.join(root, "renders")]
      .map((directory) => mkdir(directory, { recursive: true }))
  );

  let copiedAsset: string | null = null;
  if (job.brand.logoAssetId !== "none") {
    const sourceAsset = brandAssetPath(job.brand.logoAssetId);
    const extension = path.extname(sourceAsset);
    copiedAsset = path.join(assetRoot, `${job.brand.logoAssetId}${extension}`);
    await copyFile(sourceAsset, copiedAsset);
  }

  const safety = createSafetyReport(job);
  const safetyPath = path.join(sourceRoot, "safety-report.json");
  await writeFile(safetyPath, JSON.stringify(safety, null, 2));
  if (!safety.passed) throw new Error("The combined flash schedule exceeds the two-events-per-second safety cap.");

  const projectPath = path.join(projectRoot, "UPFORIT_VISUALS.aep");
  const resultPath = path.join(sourceRoot, `bridge-result-${mode}.json`);
  await rm(resultPath, { force: true });
  const bridgeInput = {
    bridgeVersion: 1,
    mode,
    job,
    assetPath: copiedAsset,
    projectPath,
    resultPath,
    intermediateRoot,
    flashEvents: safety.deliberateFlashEvents
  };
  const inputPath = path.join(sourceRoot, `bridge-input-${mode}.json`);
  await writeFile(inputPath, JSON.stringify(bridgeInput, null, 2));
  await writeFile(path.join(sourceRoot, "job.json"), JSON.stringify(job, null, 2));
  const copiedBridgePath = path.join(sourceRoot, "build-visuals.jsx");
  await copyFile(AE_BRIDGE_PATH, copiedBridgePath);
  const runnerPath = path.join(sourceRoot, `run-${mode}.jsx`);
  await writeFile(
    runnerPath,
    [
      `var UPFORIT_JOB_SPEC = ${JSON.stringify(inputPath)};`,
      `var UPFORIT_RESULT_PATH = ${JSON.stringify(resultPath)};`,
      `$.evalFile(new File(${JSON.stringify(copiedBridgePath)}));`,
      ""
    ].join("\n")
  );

  return {
    root,
    projectPath,
    resultPath,
    inputPath,
    runnerPath,
    logPath: path.join(logsRoot, `${mode}.log`),
    safetyPath
  };
}

async function buildAfterEffectsProject(job: StoredJob, mode: BuildMode) {
  await assertReady(job);
  const paths = await prepareBuild(job, mode);
  await logLine(paths.logPath, `Launching After Effects bridge in ${mode} mode.`);
  try {
    await runProcess(
      "/usr/bin/osascript",
      [
        "-e", "on run argv",
        "-e", "with timeout of 600 seconds",
        "-e", `tell application ${JSON.stringify(AFTER_EFFECTS_APP_NAME)} to DoScriptFile POSIX file (item 1 of argv)`,
        "-e", "end timeout",
        "-e", "end run",
        paths.runnerPath
      ],
      {
        timeoutMs: 10 * 60_000,
        onOutput: (line) => void logLine(paths.logPath, line)
      }
    );
  } catch (error) {
    try {
      await readFile(/* turbopackIgnore: true */ paths.resultPath, "utf8");
      await logLine(paths.logPath, `After Effects closed its AppleScript channel after writing the bridge result: ${error instanceof Error ? error.message : String(error)}`);
    } catch {
      throw error;
    }
  } finally {
    await quitAfterEffects(paths.logPath);
  }

  let result: BridgeResult;
  try {
    result = JSON.parse(
      await readFile(/* turbopackIgnore: true */ paths.resultPath, "utf8")
    ) as BridgeResult;
  } catch {
    throw new Error("After Effects exited without writing a bridge result.");
  }
  if (!result.ok) throw new Error(result.error || "After Effects could not build the project.");
  await updateJob(job.id, { failedArtists: result.failures || [] });
  if (!result.renderItems.length) {
    throw new Error(result.failures?.[0]?.error || "After Effects did not create any renderable compositions.");
  }
  if (!result.outputTemplates.includes("Lossless")) throw new Error("The required After Effects Lossless output template is unavailable.");

  const projectRelative = relativeArtifactPath(job.id, paths.projectPath);
  const safetyRelative = relativeArtifactPath(job.id, paths.safetyPath);
  await addArtifacts(job.id, [
    { kind: "project", label: "Editable After Effects project", path: projectRelative },
    { kind: "safety_report", label: "Flash safety report", path: safetyRelative, url: artifactUrl(job.id, safetyRelative) }
  ]);
  return { ...paths, result };
}

async function renderQueue(job: StoredJob, build: Awaited<ReturnType<typeof buildAfterEffectsProject>>, master: boolean) {
  await logLine(build.logPath, "Starting aerender queue.");
  await runProcess(
    AERENDER_PATH,
    ["-project", build.projectPath, "-v", "ERRORS_AND_PROGRESS", "-sound", "OFF"],
    {
      timeoutMs: 90 * 60_000,
      onOutput: (line) => void logLine(build.logPath, line)
    }
  );

  const artifacts: JobArtifact[] = [];
  for (const item of build.result.renderItems) {
    const baseName = path.basename(item.sourcePath, path.extname(item.sourcePath));
    if (master) {
      const outputPath = path.join(build.root, "renders", `${baseName}.mov`);
      await runProcess(
        FFMPEG_PATH,
        [
          "-y", "-i", item.sourcePath, "-an", "-c:v", "prores_ks", "-profile:v", "3",
          "-pix_fmt", "yuv422p10le", "-vendor", "apl0", "-color_primaries", "bt709",
          "-color_trc", "bt709", "-colorspace", "bt709", outputPath
        ],
        { timeoutMs: 60 * 60_000, onOutput: (line) => void logLine(build.logPath, line) }
      );
      const mediaExpectation: MediaExpectation = {
        codec: "prores",
        profile: "HQ",
        width: job.canvas.width,
        height: job.canvas.height,
        fps: job.canvas.fps,
        durationSeconds: job.canvas.durationSeconds,
        pixelFormat: "yuv422p10le"
      };
      const media = await validateRenderedMedia(outputPath, mediaExpectation);
      await logLine(build.logPath, `Validated ${baseName}: ProRes 422 HQ, ${job.canvas.width}x${job.canvas.height}, ${job.canvas.fps}fps, loop delta ${media.loopBoundaryScore.toFixed(3)} (adjacent ${media.loopBoundary.adjacentFrameScore.toFixed(3)}, limit ${media.loopBoundary.allowedDifference.toFixed(3)}).`);
      const relative = relativeArtifactPath(job.id, outputPath);
      artifacts.push({
        kind: "master",
        label: item.label,
        path: relative,
        url: artifactUrl(job.id, relative),
        artist: item.artist,
        layout: item.layout
      });
    } else {
      const outputPath = path.join(build.root, "previews", `${baseName}.mp4`);
      const posterPath = path.join(build.root, "previews", `${baseName}.jpg`);
      await runProcess(
        FFMPEG_PATH,
        [
          "-y", "-i", item.sourcePath, "-an", "-c:v", "libx264", "-preset", "medium",
          "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", outputPath
        ],
        { timeoutMs: 30 * 60_000, onOutput: (line) => void logLine(build.logPath, line) }
      );
      const mediaExpectation: MediaExpectation = {
        codec: "h264",
        width: 960,
        height: 540,
        fps: job.canvas.fps,
        durationSeconds: job.canvas.durationSeconds,
        pixelFormat: "yuv420p"
      };
      const media = await validateRenderedMedia(outputPath, mediaExpectation);
      await logLine(build.logPath, `Validated ${baseName}: H.264, 960x540, ${job.canvas.fps}fps, loop delta ${media.loopBoundaryScore.toFixed(3)} (adjacent ${media.loopBoundary.adjacentFrameScore.toFixed(3)}, limit ${media.loopBoundary.allowedDifference.toFixed(3)}).`);
      await runProcess(
        FFMPEG_PATH,
        ["-y", "-ss", "0.3", "-i", outputPath, "-frames:v", "1", "-q:v", "2", posterPath],
        { timeoutMs: 60_000 }
      );
      const relative = relativeArtifactPath(job.id, outputPath);
      const posterRelative = relativeArtifactPath(job.id, posterPath);
      artifacts.push(
        {
          kind: "preview", label: item.label, path: relative, url: artifactUrl(job.id, relative),
          artist: item.artist, layout: item.layout
        },
        {
          kind: "poster", label: `${item.label} poster`, path: posterRelative,
          url: artifactUrl(job.id, posterRelative), artist: item.artist, layout: item.layout
        }
      );
    }
    await rm(item.sourcePath, { force: true }).catch(() => undefined);
  }
  await addArtifacts(job.id, artifacts);
  return artifacts;
}

async function failJob(id: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected render failure.";
  await updateJob(id, { status: "failed", progress: 0, statusMessage: "Job failed", error: message });
}

export async function runPreview(id: string) {
  return withJobLock(id, async () => {
    try {
      let job = await readJob(id);
      job = await updateJob(id, { status: "building", progress: 10, statusMessage: "Building editable After Effects project", error: undefined, failedArtists: [] });
      const build = await buildAfterEffectsProject(job, "preview");
      await updateJob(id, { status: "rendering_preview", progress: 55, statusMessage: "Rendering H.264 preview" });
      await renderQueue(job, build, false);
      return updateJob(id, { status: "preview_ready", progress: 100, statusMessage: "Preview ready" });
    } catch (error) {
      await failJob(id, error);
      throw error;
    }
  });
}

export async function runBatchBuild(id: string) {
  return withJobLock(id, async () => {
    try {
      let job = await readJob(id);
      if (job.content.kind !== "artist_batch") throw new Error("Batch builds require an artist job.");
      const layoutLabel = job.content.kind === "artist_batch" && job.content.layouts.length === 1
        ? `${job.content.layouts[0] === "center" ? "Centre" : "Top Third"} layout`
        : "Centre and Top Third layouts";
      job = await updateJob(id, { status: "batch_building", progress: 15, statusMessage: `Building ${layoutLabel} for every artist`, error: undefined, failedArtists: [] });
      await buildAfterEffectsProject(job, "batch");
      const built = await readJob(id);
      return updateJob(id, {
        status: "preview_ready",
        progress: 100,
        statusMessage: built.failedArtists.length
          ? `Editable batch ready; ${built.failedArtists.length} artist name${built.failedArtists.length === 1 ? "" : "s"} need retry`
          : "Editable artist batch project ready"
      });
    } catch (error) {
      await failJob(id, error);
      throw error;
    }
  });
}

export async function runMaster(id: string) {
  return withJobLock(id, async () => {
    try {
      let job = await readJob(id);
      job = await updateJob(id, {
        status: job.content.kind === "artist_batch" ? "batch_building" : "building",
        progress: 10,
        statusMessage: "Preparing full-resolution masters",
        error: undefined,
        failedArtists: []
      });
      const build = await buildAfterEffectsProject(job, job.content.kind === "artist_batch" ? "batch" : "master");
      await updateJob(id, {
        status: "rendering_master",
        progress: 45,
        statusMessage: job.content.kind === "artist_batch" ? "Rendering all artist masters" : "Rendering ProRes master"
      });
      await renderQueue(job, build, true);
      const rendered = await readJob(id);
      return updateJob(id, {
        status: "complete",
        progress: 100,
        statusMessage: rendered.failedArtists.length
          ? `Masters complete; ${rendered.failedArtists.length} artist name${rendered.failedArtists.length === 1 ? "" : "s"} need retry`
          : "Master render complete"
      });
    } catch (error) {
      await failJob(id, error);
      throw error;
    }
  });
}

export async function revealJob(id: string, target: "project" | "folder") {
  const job = await readJob(id);
  const project = job.artifacts.find((artifact) => artifact.kind === "project");
  const targetPath = target === "project" && project
    ? path.join(jobDirectory(id), project.path)
    : jobDirectory(id);
  await runProcess("open", [targetPath], { timeoutMs: 10_000 });
}
