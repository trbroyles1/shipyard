import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSession, extractAccessToken } from "@/lib/auth-helpers";
import { gitlabFetchAllPages, GitLabApiError } from "@/lib/gitlab-client";
import { createLogger } from "@/lib/logger";
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
