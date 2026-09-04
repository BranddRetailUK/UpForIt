import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FFMPEG_PATH, FFPROBE_PATH } from "./constants";
import { runProcess } from "./process";

type ProbeStream = {
  codec_type?: string;
  codec_name?: string;
  profile?: string;
  width?: number;
  height?: number;
  pix_fmt?: string;
  r_frame_rate?: string;
  nb_read_frames?: string;
};

export type MediaProbe = {
  streams?: ProbeStream[];
  format?: { duration?: string };
};

export type MediaExpectation = {
  codec: "h264" | "prores";
  profile?: "HQ";
  width: number;
  height: number;
  fps: 25 | 50;
  durationSeconds: 10 | 20 | 30;
  pixelFormat: "yuv420p" | "yuv422p10le";
};

function fractionToNumber(value: string | undefined) {
  if (!value) return Number.NaN;
  const [numerator, denominator = 1] = value.split("/").map(Number);
  return denominator ? numerator / denominator : Number.NaN;
}

export function validateMediaProbe(probe: MediaProbe, expected: MediaExpectation) {
  const video = probe.streams?.find((stream) => stream.codec_type === "video") || probe.streams?.[0];
  if (!video) throw new Error("Rendered file has no video stream.");
  if (video.codec_name !== expected.codec) {
    throw new Error(`Expected ${expected.codec}; rendered ${video.codec_name || "an unknown codec"}.`);
  }
  if (expected.profile && video.profile !== expected.profile) {
    throw new Error(`Expected ${expected.codec} ${expected.profile}; rendered profile ${video.profile || "unknown"}.`);
  }
  if (video.width !== expected.width || video.height !== expected.height) {
    throw new Error(`Expected ${expected.width}x${expected.height}; rendered ${video.width || 0}x${video.height || 0}.`);
  }
  const fps = fractionToNumber(video.r_frame_rate);
  if (Math.abs(fps - expected.fps) > 0.001) {
    throw new Error(`Expected ${expected.fps}fps; rendered ${Number.isFinite(fps) ? fps : "an unknown frame rate"}.`);
  }
  const duration = Number(probe.format?.duration);
  if (!Number.isFinite(duration) || Math.abs(duration - expected.durationSeconds) > 1 / expected.fps) {
    throw new Error(`Expected ${expected.durationSeconds}s; rendered ${Number.isFinite(duration) ? duration : "an unknown duration"}.`);
  }
  if (video.pix_fmt !== expected.pixelFormat) {
    throw new Error(`Expected ${expected.pixelFormat}; rendered ${video.pix_fmt || "an unknown pixel format"}.`);
  }
  const frameCount = Number(video.nb_read_frames);
  const expectedFrames = expected.durationSeconds * expected.fps;
  if (Number.isFinite(frameCount) && frameCount !== expectedFrames) {
    throw new Error(`Expected ${expectedFrames} frames; rendered ${frameCount}.`);
  }
  return { video, duration, frameCount: Number.isFinite(frameCount) ? frameCount : expectedFrames };
}

export function validateLoopBoundaryScore(
  score: number,
  adjacentFrameScore = 0,
  minimumAllowedDifference = 5
) {
  if (!Number.isFinite(score)) throw new Error("Could not measure the loop-boundary frame difference.");
  if (!Number.isFinite(adjacentFrameScore)) throw new Error("Could not measure normal adjacent-frame motion.");
  const allowedDifference = Math.max(minimumAllowedDifference, adjacentFrameScore * 2.5 + 0.5);
  if (score > allowedDifference) {
    throw new Error(
      `Loop boundary average luma difference ${score.toFixed(3)} exceeds the motion-adjusted limit ${allowedDifference.toFixed(3)}.`
    );
  }
  return { score, adjacentFrameScore, allowedDifference };
}

export async function probeMedia(filePath: string, expected: MediaExpectation) {
  const result = await runProcess(
    FFPROBE_PATH,
    [
      "-v", "error", "-count_frames",
      "-show_entries", "stream=codec_type,codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_read_frames:format=duration",
      "-of", "json", filePath
    ],
    { timeoutMs: 2 * 60_000 }
  );
  let probe: MediaProbe;
  try {
    probe = JSON.parse(result.stdout) as MediaProbe;
  } catch {
    throw new Error("FFprobe returned an unreadable media report.");
  }
  return validateMediaProbe(probe, expected);
}

export async function measureLoopBoundary(filePath: string, frameCount: number) {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "upforit-loop-check-"));
  const firstFrame = path.join(temporaryRoot, "first.png");
  const secondFrame = path.join(temporaryRoot, "second.png");
  const lastFrame = path.join(temporaryRoot, "last.png");
  try {
    await runProcess(
      FFMPEG_PATH,
      ["-v", "error", "-i", filePath, "-vf", "select=eq(n\\,0),format=rgb24", "-frames:v", "1", firstFrame],
      { timeoutMs: 2 * 60_000 }
    );
    await runProcess(
      FFMPEG_PATH,
      ["-v", "error", "-i", filePath, "-vf", "select=eq(n\\,1),format=rgb24", "-frames:v", "1", secondFrame],
      { timeoutMs: 2 * 60_000 }
    );
    await runProcess(
      FFMPEG_PATH,
      ["-v", "error", "-i", filePath, "-vf", `select=eq(n\\,${Math.max(0, frameCount - 1)}),format=rgb24`, "-frames:v", "1", lastFrame],
      { timeoutMs: 2 * 60_000 }
    );
    const compare = async (left: string, right: string) => {
      const comparison = await runProcess(
        FFMPEG_PATH,
        [
          "-v", "info", "-i", left, "-i", right,
          "-lavfi", "blend=all_mode=difference,signalstats,metadata=print",
          "-frames:v", "1", "-f", "null", "-"
        ],
        { timeoutMs: 2 * 60_000 }
      );
      const output = `${comparison.stdout}\n${comparison.stderr}`;
      return Number(output.match(/lavfi\.signalstats\.YAVG=([0-9.]+)/)?.[1]);
    };
    const [score, adjacentFrameScore] = await Promise.all([
      compare(firstFrame, lastFrame),
      compare(firstFrame, secondFrame)
    ]);
    return validateLoopBoundaryScore(score, adjacentFrameScore);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

export async function validateRenderedMedia(filePath: string, expected: MediaExpectation) {
  const probe = await probeMedia(filePath, expected);
  const loopBoundary = await measureLoopBoundary(filePath, probe.frameCount);
  return { ...probe, loopBoundaryScore: loopBoundary.score, loopBoundary };
}
