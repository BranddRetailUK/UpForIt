import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { JOBS_ROOT, RUNTIME_ROOT } from "./constants";
import type { JobArtifact, JobStatus, StoredJob, VisualJobV1 } from "./contracts";
import { emitJobEvent } from "./job-events";
import { validateVisualJob } from "./validation";

const JOB_ID_PATTERN = /^[a-f0-9-]{36}$/;
let activeJobId: string | null = null;
const deletingJobIds = new Set<string>();

export function getActiveJobId() {
  return activeJobId;
}

export function assertJobId(id: string) {
  if (!JOB_ID_PATTERN.test(id)) throw new Error("Invalid job identifier.");
  return id;
}

export function jobDirectory(id: string) {
  const directory = path.resolve(JOBS_ROOT, assertJobId(id));
  if (!directory.startsWith(`${path.resolve(JOBS_ROOT)}${path.sep}`)) throw new Error("Invalid job path.");
  return directory;
}

function jobFile(id: string) {
  return path.join(jobDirectory(id), "job.json");
}

export async function ensureRuntimeDirectories() {
  await mkdir(JOBS_ROOT, { recursive: true });
  await mkdir(RUNTIME_ROOT, { recursive: true });
}

export async function createJob(input: Omit<VisualJobV1, "id"> & { id?: string }) {
  const job = validateVisualJob({ ...input, id: input.id || randomUUID() });
  const now = new Date().toISOString();
  const stored: StoredJob = {
    ...job,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    progress: 0,
    statusMessage: "Ready to build",
    failedArtists: [],
    artifacts: []
  };
  await mkdir(jobDirectory(stored.id), { recursive: true });
  await writeJob(stored);
  return stored;
}

export async function readJob(id: string): Promise<StoredJob> {
  const contents = await readFile(jobFile(id), "utf8");
  const job = JSON.parse(contents) as StoredJob;
  return { ...job, failedArtists: Array.isArray(job.failedArtists) ? job.failedArtists : [] };
}

export async function writeJob(job: StoredJob) {
  await mkdir(jobDirectory(job.id), { recursive: true });
  const updated = { ...job, updatedAt: new Date().toISOString() };
  const temporary = `${jobFile(job.id)}.tmp`;
  await writeFile(temporary, JSON.stringify(updated, null, 2));
  await rename(temporary, jobFile(job.id));
  return updated;
}

export async function updateJob(
  id: string,
  patch: Partial<Pick<StoredJob, "status" | "progress" | "statusMessage" | "error" | "failedArtists" | "artifacts">>
) {
  const current = await readJob(id);
  const updated = await writeJob({ ...current, ...patch });
  emitJobEvent({
    jobId: id,
    at: updated.updatedAt,
    status: updated.status,
    progress: updated.progress,
    message: updated.statusMessage
  });
  return updated;
}

export async function addArtifacts(id: string, artifacts: JobArtifact[]) {
  const current = await readJob(id);
  const byKey = new Map(current.artifacts.map((item) => [`${item.kind}:${item.path}`, item]));
  for (const artifact of artifacts) byKey.set(`${artifact.kind}:${artifact.path}`, artifact);
  return updateJob(id, { artifacts: [...byKey.values()] });
}

export async function listJobs() {
  await ensureRuntimeDirectories();
  const entries = await readdir(JOBS_ROOT, { withFileTypes: true });
  const jobs: StoredJob[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !JOB_ID_PATTERN.test(entry.name)) continue;
    try {
      const job = await readJob(entry.name);
      if (["building", "rendering_preview", "batch_building", "batch_rendering", "rendering_master"].includes(job.status) && activeJobId !== job.id) {
        jobs.push(await writeJob({ ...job, status: "interrupted", statusMessage: "Interrupted by a studio restart" }));
      } else {
        jobs.push(job);
      }
    } catch {
      // Ignore incomplete/corrupt runtime directories and keep the rest of the history usable.
    }
  }
  return jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteJob(id: string) {
  assertJobId(id);
  if (activeJobId === id) throw new Error("An active render cannot be deleted.");
  if (deletingJobIds.has(id)) throw new Error("This render is already being deleted.");
  deletingJobIds.add(id);
  try {
    await readJob(id);
    if (activeJobId === id) throw new Error("An active render cannot be deleted.");
    await rm(jobDirectory(id), { recursive: true, force: false });
  } finally {
    deletingJobIds.delete(id);
  }
}

export async function withJobLock<T>(id: string, task: () => Promise<T>) {
  if (deletingJobIds.has(id)) throw new Error("This render is being deleted.");
  if (activeJobId && activeJobId !== id) throw new Error(`Job ${activeJobId} is already using After Effects.`);
  if (activeJobId === id) throw new Error("This job is already running.");
  activeJobId = id;
  try {
    return await task();
  } finally {
    activeJobId = null;
  }
}

export function relativeArtifactPath(id: string, absolutePath: string) {
  const root = jobDirectory(id);
  const relative = path.relative(root, absolutePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Artifact escaped the job directory.");
  return relative;
}
