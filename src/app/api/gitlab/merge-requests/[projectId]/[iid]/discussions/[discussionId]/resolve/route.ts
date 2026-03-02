import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSession, extractAccessToken, parseBody } from "@/lib/auth-helpers";
import { gitlabFetch } from "@/lib/gitlab-client";
import { createLogger } from "@/lib/logger";
import { handleApiRouteError } from "@/lib/api-error-handler";

const log = createLogger("api/mr-discussion-resolve");

export async function PUT(
  req: NextRequest,
  { params }: { params: { projectId: string; iid: string; discussionId: string } },
) {
  try {
    const session = await getAuthenticatedSession();
    const token = extractAccessToken(session);
    const { projectId, iid, discussionId } = params;

    const parsed = await parseBody<{ resolved?: boolean }>(req);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;

    log.info(`${body.resolved ? "Resolving" : "Unresolving"} discussion: project=${projectId} iid=${iid} discussion=${discussionId}`);

    await gitlabFetch(
      `/projects/${projectId}/merge_requests/${iid}/discussions/${discussionId}`,
      token,
      { method: "PUT", body: { resolved: body.resolved } },
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiRouteError(error, log);
  }
}
