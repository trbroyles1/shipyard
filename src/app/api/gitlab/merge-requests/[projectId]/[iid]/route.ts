import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSession, extractAccessToken } from "@/lib/auth-helpers";
import { gitlabFetch } from "@/lib/gitlab-client";
import { setViewedMR } from "@/lib/viewed-mr-store";
import { createLogger } from "@/lib/logger";
import { handleApiRouteError } from "@/lib/api-error-handler";
import type { GitLabMergeRequest, GitLabApprovals } from "@/lib/types/gitlab";

const log = createLogger("api/mr-detail");

export async function GET(
  _req: NextRequest,
  { params }: { params: { projectId: string; iid: string } },
) {
  try {
    const session = await getAuthenticatedSession();
    const token = extractAccessToken(session);
    const { projectId, iid } = params;

    log.info(`Fetching MR detail: project=${projectId} iid=${iid}`);

    if (session.gitlabUserId) {
      setViewedMR(session.gitlabUserId, Number(projectId), Number(iid));
    }

    const [mr, approvals] = await Promise.all([
      gitlabFetch<GitLabMergeRequest>(
        `/projects/${projectId}/merge_requests/${iid}?with_merge_status_recheck=true`,
        token,
      ),
      gitlabFetch<GitLabApprovals>(
        `/projects/${projectId}/merge_requests/${iid}/approvals`,
        token,
      ),
    ]);

    return NextResponse.json({ mr, approvals });
  } catch (error) {
    return handleApiRouteError(error, log);
  }
}
