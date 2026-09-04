import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { artistJob } from "./fixtures";

describe("job recovery, locking and deletion", () => {
  it("recovers interrupted state, permits only one active AE job and guards deletion", async () => {
    const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "upforit-jobs-test-"));
    const previousRuntime = process.env.VISUALS_RUNTIME_ROOT;
    process.env.VISUALS_RUNTIME_ROOT = temporaryRoot;
    vi.resetModules();
    try {
      const jobs = await import("../lib/jobs");
      const id = randomUUID();
      await jobs.createJob({ ...artistJob(), id });
      await jobs.updateJob(id, { status: "building", statusMessage: "Building" });
      const recovered = (await jobs.listJobs()).find((job) => job.id === id);
      expect(recovered?.status).toBe("interrupted");

      let release!: () => void;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      const first = jobs.withJobLock(id, () => gate);
      await Promise.resolve();
      expect(jobs.getActiveJobId()).toBe(id);
      await expect(jobs.withJobLock(randomUUID(), async () => undefined)).rejects.toThrow(/already using After Effects/);
      await expect(jobs.deleteJob(id)).rejects.toThrow(/active render cannot be deleted/);
      release();
      await first;
      expect(jobs.getActiveJobId()).toBeNull();
      await jobs.deleteJob(id);
      await expect(jobs.readJob(id)).rejects.toThrow();
    } finally {
      if (previousRuntime === undefined) delete process.env.VISUALS_RUNTIME_ROOT;
      else process.env.VISUALS_RUNTIME_ROOT = previousRuntime;
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });
});
