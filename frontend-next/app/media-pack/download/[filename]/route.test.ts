import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import manifest from "../../assets.json";

const request = new Request("https://www.upforitevents.co.uk/media-pack/download/test");
const context = (filename: string) => ({ params: Promise.resolve({ filename }) });
afterEach(() => vi.unstubAllGlobals());

describe("media pack downloads", () => {
  it.each(["asset", "zip"])("streams the Cloudinary %s with the exact attachment filename", async kind => {
    const filename = kind === "zip" ? "UPFORIT-Media-Pack.zip" : manifest.files[0].downloadName;
    const url = kind === "zip" ? manifest.zipUrl : manifest.files[0].url;
    const bytes = new Uint8Array([0, 1, 127, 255]);
    const fetch = vi.fn().mockResolvedValue(new Response(bytes));
    vi.stubGlobal("fetch", fetch);
    const response = await GET(request, context(filename));
    expect(fetch).toHaveBeenCalledWith(url, { cache: "no-store" });
    expect(response.headers.get("Content-Disposition")).toBe(`attachment; filename="${filename}"`);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  });
  it("rejects unlisted names without fetching", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect((await GET(request, context("https://example.com/private"))).status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("returns a retryable error instead of a broken download", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("missing", { status: 404 })));
    const response = await GET(request, context("UPFORIT-Media-Pack.zip"));
    expect(response.status).toBe(502);
    expect(response.headers.has("Content-Disposition")).toBe(false);
  });
});
