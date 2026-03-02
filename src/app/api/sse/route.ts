import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { createLogger } from "@/lib/logger";
import { startPoller } from "@/lib/mr-poller";
import { clearViewedMR } from "@/lib/viewed-mr-store";

const log = createLogger("api/sse");

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const jwt = await getToken({ req, secret: process.env.AUTH_SECRET });
  if (!jwt?.accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  const token = jwt.accessToken as string;
  const userId = jwt.gitlabUserId as number | undefined;
  const expiresAt = jwt.expiresAt as number;

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

      pollerHandle = startPoller(token, userId, expiresAt, (event) => {
        send(event.type, event.data);
      });
    },
    cancel() {
      log.info(`SSE connection closed for user ${userId} — clearing viewed MR`);
      pollerHandle?.stop();
      if (userId !== undefined) {
        clearViewedMR(userId);
      }
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
