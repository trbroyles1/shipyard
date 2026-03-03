import { type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import { startPoller } from "@/lib/mr-poller";
import { clearViewedMR } from "@/lib/viewed-mr-store";
import {
  registerSession,
  unregisterSession,
  getActiveTabId,
} from "@/lib/active-session-store";
import {
  SSE_ERROR_SESSION_DISPLACED,
  SSE_EVENT_SESSION_DISPLACED,
} from "@/lib/errors";
import { SSE_RESPONSE_HEADERS } from "@/lib/constants";

const log = createLogger("api/sse");

const SESSION_DISPLACED_MESSAGE = "Session displaced by another tab";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const tabId = req.nextUrl.searchParams.get("tabId");
  if (!tabId) {
    return new Response("Missing required tabId parameter", { status: 400 });
  }

  const jwt = await getToken({ req, secret: env.AUTH_SECRET });
  if (!jwt?.accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  const token = jwt.accessToken as string;
  const userId = jwt.gitlabUserId as number | undefined;
  const expiresAt = typeof jwt.expiresAt === "number" ? jwt.expiresAt : 0;

  log.info(`SSE connection opened for user ${userId}, tab ${tabId}`);

  const encoder = new TextEncoder();
  let pollerHandle: ReturnType<typeof startPoller> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      function send(event: string, data: unknown) {
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        } catch {
          // Controller closed — stop polling
          pollerHandle?.stop();
        }
      }

      pollerHandle = startPoller(token, userId, expiresAt, (event) => {
        send(event.type, event.data);
      });

      if (userId !== undefined) {
        const displaceFn = () => {
          send(SSE_EVENT_SESSION_DISPLACED, {
            code: SSE_ERROR_SESSION_DISPLACED,
            message: SESSION_DISPLACED_MESSAGE,
          });
          pollerHandle?.stop();
          controller.close();
        };
        registerSession(userId, tabId, displaceFn);
      }
    },
    cancel() {
      log.info(`SSE connection closed for user ${userId} — clearing viewed MR`);
      pollerHandle?.stop();
      if (userId !== undefined) {
        if (getActiveTabId(userId) === tabId) {
          clearViewedMR(userId);
        }
        unregisterSession(userId, tabId);
      }
    },
  });

  return new Response(stream, {
    headers: SSE_RESPONSE_HEADERS,
  });
}
