import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSession, extractAccessToken } from "@/lib/auth-helpers";
import { gitlabFetchAllPages } from "@/lib/gitlab-client";
import { createLogger } from "@/lib/logger";
import { handleApiRouteError } from "@/lib/api-error-handler";
import type { GitLabJob } from "@/lib/types/gitlab";

const log = createLogger("api/pipeline-jobs");

export async function GET(
  _req: NextRequest,
  { params }: { params: { projectId: string; pipelineId: string } },
) {
  try {
    const session = await getAuthenticatedSession();
    const token = extractAccessToken(session);
    const { projectId, pipelineId } = params;

    log.info(`Fetching pipeline jobs: project=${projectId} pipeline=${pipelineId}`);

    const jobs = await gitlabFetchAllPages<GitLabJob>(
      `/projects/${projectId}/pipelines/${pipelineId}/jobs`,
      token,
    );

    return NextResponse.json(jobs);
  } catch (error) {
    return handleApiRouteError(error, log);
  }
}
