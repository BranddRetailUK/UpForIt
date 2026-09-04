import { describe, expect, it } from "vitest";
import { isLoopbackHost } from "../lib/security";

describe("loopback request boundary", () => {
  it("accepts localhost, IPv4 loopback and bracketed IPv6 loopback", () => {
    expect(isLoopbackHost("localhost:4310")).toBe(true);
    expect(isLoopbackHost("127.0.0.1:4310")).toBe(true);
    expect(isLoopbackHost("[::1]:4310")).toBe(true);
  });

  it("rejects wildcard, LAN and lookalike hosts", () => {
    expect(isLoopbackHost("0.0.0.0:4310")).toBe(false);
    expect(isLoopbackHost("192.168.1.20:4310")).toBe(false);
    expect(isLoopbackHost("localhost.example.com:4310")).toBe(false);
  });
});
