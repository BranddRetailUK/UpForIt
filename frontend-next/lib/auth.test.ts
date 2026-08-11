import { describe, expect, it, vi } from "vitest";
import { createSessionForUser } from "./auth";
import { sha256 } from "./security";

describe("account sessions", () => {
  it("stores only a hash while returning the one-time browser session token", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1 });
    const before = Date.now();
    const session = await createSessionForUser({ query } as never, "user-123");
    const values = query.mock.calls[0][1] as unknown[];

    expect(String(session.token)).not.toBe(String(values[2]));
    expect(values[2]).toBe(sha256(session.token));
    expect(values[1]).toBe("user-123");
    expect(session.expiresAt.getTime()).toBeGreaterThan(before + 29 * 24 * 60 * 60 * 1000);
  });
});
