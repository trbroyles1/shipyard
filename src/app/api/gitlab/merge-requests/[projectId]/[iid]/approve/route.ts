import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSession, extractAccessToken, parseBody } from "@/lib/auth-helpers";
import { gitlabFetch } from "@/lib/gitlab-client";
import { createLogger } from "@/lib/logger";
import { handleApiRouteError } from "@/lib/api-error-handler";

const log = createLogger("api/mr-approve");

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string; iid: string } },
) {
  try {
    const session = await getAuthenticatedSession();
    const token = extractAccessToken(session);
    const { projectId, iid } = params;

    const parsed = await parseBody<{ sha?: string }>(req);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;

    log.info(`Approving MR: project=${projectId} iid=${iid}`);

    await gitlabFetch(
      `/projects/${projectId}/merge_requests/${iid}/approve`,
      token,
      { method: "POST", body: body.sha ? { sha: body.sha } : undefined },
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiRouteError(error, log);
  }
}
