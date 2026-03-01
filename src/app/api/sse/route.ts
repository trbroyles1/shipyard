import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { createLogger } from "@/lib/logger";
import { startPoller } from "@/lib/mr-poller";

const log = createLogger("api/sse");

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  const token = session.accessToken;
  const userId = session.gitlabUserId;

  log.info(`SSE connection opened for user ${userId}`);

  const encoder = new TextEncoder();
  let pollerHandle: ReturnType<typeof startPoller> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      function send(event: string, data: unknown) {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // Controller closed — stop polling
          pollerHandle?.stop();
        }
      }

      pollerHandle = startPoller(token, (event) => {
        send(event.type, event.data);
      });
    },
    cancel() {
      log.info(`SSE connection closed for user ${userId}`);
      pollerHandle?.stop();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
