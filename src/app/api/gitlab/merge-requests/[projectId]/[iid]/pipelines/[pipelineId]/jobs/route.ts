import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSession, getAccessToken } from "@/lib/auth-helpers";
import { gitlabFetchAllPages } from "@/lib/gitlab-client";
import { validateNumericId } from "@/lib/validation";
import { createLogger } from "@/lib/logger";
import { handleApiRouteError } from "@/lib/api-error-handler";
import type { GitLabJob } from "@/lib/types/gitlab";

const log = createLogger("api/pipeline-jobs");

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ projectId: string; pipelineId: string }> }
) {
  const params = await props.params;
  try {
    await getAuthenticatedSession();
    const token = await getAccessToken(req);
    const projectId = validateNumericId(params.projectId, "projectId");
    const pipelineId = validateNumericId(params.pipelineId, "pipelineId");

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
