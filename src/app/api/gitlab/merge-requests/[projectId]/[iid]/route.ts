import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSession, extractAccessToken } from "@/lib/auth-helpers";
import { gitlabFetch, GitLabApiError } from "@/lib/gitlab-client";
import { setViewedMR } from "@/lib/viewed-mr-store";
import { createLogger } from "@/lib/logger";
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
    if (error instanceof GitLabApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.message.includes("Not authenticated")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    log.error(`Unexpected error: ${error}`);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
