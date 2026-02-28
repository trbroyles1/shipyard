import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSession, extractAccessToken } from "@/lib/auth-helpers";
import { gitlabFetchAllPages, GitLabApiError } from "@/lib/gitlab-client";
import { createLogger } from "@/lib/logger";
import type { GitLabPipeline } from "@/lib/types/gitlab";

const log = createLogger("api/mr-pipelines");

export async function GET(
  _req: NextRequest,
  { params }: { params: { projectId: string; iid: string } },
) {
  try {
    const session = await getAuthenticatedSession();
    const token = extractAccessToken(session);
    const { projectId, iid } = params;

    log.info(`Fetching MR pipelines: project=${projectId} iid=${iid}`);

    const pipelines = await gitlabFetchAllPages<GitLabPipeline>(
      `/projects/${projectId}/merge_requests/${iid}/pipelines`,
      token,
    );

    return NextResponse.json(pipelines);
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
