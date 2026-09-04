import type { NextRequest } from "next/server";
import { assertJobId, readJob } from "@/lib/jobs";
import type { JobEvent } from "@/lib/contracts";
import { jobEvents } from "@/lib/job-events";
import { assertLocalRequest, apiError } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertLocalRequest(request);
    const { id } = await context.params;
    assertJobId(id);
    const initial = await readJob(id);
    const encoder = new TextEncoder();
    let ping: ReturnType<typeof setInterval> | undefined;
    let listener: ((event: JobEvent) => void) | undefined;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (event: JobEvent) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };
        listener = send;
        jobEvents.on(id, send);
        send({
          jobId: id,
          at: initial.updatedAt,
          status: initial.status,
          progress: initial.progress,
          message: initial.statusMessage
        });
        ping = setInterval(() => controller.enqueue(encoder.encode(": ping\n\n")), 15_000);
      },
      cancel() {
        if (listener) jobEvents.off(id, listener);
        if (ping) clearInterval(ping);
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      }
    });
  } catch (error) {
    return apiError(error, 404);
  }
}
