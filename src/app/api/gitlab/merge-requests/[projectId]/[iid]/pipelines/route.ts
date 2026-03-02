import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSession, extractAccessToken } from "@/lib/auth-helpers";
import { gitlabFetchAllPages } from "@/lib/gitlab-client";
import { createLogger } from "@/lib/logger";
import { handleApiRouteError } from "@/lib/api-error-handler";
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
    return handleApiRouteError(error, log);
  }
}
