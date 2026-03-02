import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSession, extractAccessToken } from "@/lib/auth-helpers";
import { gitlabFetchAllPages } from "@/lib/gitlab-client";
import { createLogger } from "@/lib/logger";
import { handleApiRouteError } from "@/lib/api-error-handler";
import type { GitLabCommit } from "@/lib/types/gitlab";

const log = createLogger("api/mr-commits");

export async function GET(
  _req: NextRequest,
  { params }: { params: { projectId: string; iid: string } },
) {
  try {
    const session = await getAuthenticatedSession();
    const token = extractAccessToken(session);
    const { projectId, iid } = params;

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
