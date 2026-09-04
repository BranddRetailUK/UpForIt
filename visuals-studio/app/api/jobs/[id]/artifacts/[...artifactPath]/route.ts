import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { assertJobId, jobDirectory } from "@/lib/jobs";
import { assertLocalRequest, apiError } from "@/lib/security";

const CONTENT_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".json": "application/json",
  ".log": "text/plain"
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; artifactPath: string[] }> }
) {
  try {
    assertLocalRequest(request);
    const { id, artifactPath } = await context.params;
    assertJobId(id);
    const root = jobDirectory(id);
    const filePath = path.resolve(root, ...artifactPath);
    if (!filePath.startsWith(`${root}${path.sep}`)) throw new Error("Invalid artifact path.");
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("Artifact is not a file.");
    const contentType = CONTENT_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    const range = request.headers.get("range");

    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match) return new Response(null, { status: 416 });
      const start = Number(match[1]);
      const end = match[2] ? Math.min(Number(match[2]), info.size - 1) : info.size - 1;
      if (start > end || start >= info.size) return new Response(null, { status: 416 });
      const stream = createReadStream(filePath, { start, end });
      return new Response(Readable.toWeb(stream) as ReadableStream, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(end - start + 1),
          "Content-Range": `bytes ${start}-${end}/${info.size}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "private, no-store"
        }
      });
    }

    return new Response(Readable.toWeb(createReadStream(filePath)) as ReadableStream, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(info.size),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error) {
    return apiError(error, 404);
  }
}
