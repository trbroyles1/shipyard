import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSession, getAccessToken } from "@/lib/auth-helpers";
import { gitlabFetch } from "@/lib/gitlab-client";
import { validateNumericId } from "@/lib/validation";
import { setViewedMR } from "@/lib/viewed-mr-store";
import { createLogger } from "@/lib/logger";
import { handleApiRouteError } from "@/lib/api-error-handler";
import type { GitLabMergeRequest, GitLabApprovals } from "@/lib/types/gitlab";

const log = createLogger("api/mr-detail");

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ projectId: string; iid: string }> }
) {
  const params = await props.params;
  try {
    const session = await getAuthenticatedSession();
    const token = await getAccessToken(req);
    const projectId = validateNumericId(params.projectId, "projectId");
    const iid = validateNumericId(params.iid, "iid");

    log.info(`Fetching MR detail: project=${projectId} iid=${iid}`);

    if (session.gitlabUserId) {
      setViewedMR(session.gitlabUserId, projectId, iid);
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
