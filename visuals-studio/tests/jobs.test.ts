import { describe, expect, it } from "vitest";
import { assertJobId, jobDirectory } from "../lib/jobs";

describe("job path containment", () => {
  it("accepts UUID job directories", () => {
    expect(jobDirectory("11111111-1111-4111-8111-111111111111")).toContain("11111111-1111-4111-8111-111111111111");
  });

  it("rejects traversal and arbitrary names", () => {
    expect(() => assertJobId("../../frontend-next")).toThrow(/identifier/);
    expect(() => assertJobId("not-a-job")).toThrow(/identifier/);
  });
});
