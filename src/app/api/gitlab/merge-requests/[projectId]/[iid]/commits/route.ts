import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSession, getAccessToken } from "@/lib/auth-helpers";
import { gitlabFetchAllPages } from "@/lib/gitlab-client";
import { validateNumericId } from "@/lib/validation";
import { createLogger } from "@/lib/logger";
import { handleApiRouteError } from "@/lib/api-error-handler";
import type { GitLabCommit } from "@/lib/types/gitlab";

const log = createLogger("api/mr-commits");

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ projectId: string; iid: string }> }
) {
  const params = await props.params;
  try {
    await getAuthenticatedSession();
    const token = await getAccessToken(req);
    const projectId = validateNumericId(params.projectId, "projectId");
    const iid = validateNumericId(params.iid, "iid");

    log.info(`Fetching MR commits: project=${projectId} iid=${iid}`);

    const commits = await gitlabFetchAllPages<GitLabCommit>(
      `/projects/${projectId}/merge_requests/${iid}/commits`,
      token,
    );

    return NextResponse.json(commits);
  } catch (error) {
    return handleApiRouteError(error, log);
  }
}
