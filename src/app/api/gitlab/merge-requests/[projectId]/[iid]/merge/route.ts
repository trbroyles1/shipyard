import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSession, extractAccessToken, parseBody } from "@/lib/auth-helpers";
import { gitlabFetch } from "@/lib/gitlab-client";
import { createLogger } from "@/lib/logger";
import { handleApiRouteError } from "@/lib/api-error-handler";

const log = createLogger("api/mr-merge");

export async function PUT(
  req: NextRequest,
  { params }: { params: { projectId: string; iid: string } },
) {
  try {
    const session = await getAuthenticatedSession();
    const token = extractAccessToken(session);
    const { projectId, iid } = params;

    const parsed = await parseBody<{ sha?: string; squash?: boolean; should_remove_source_branch?: boolean; merge_when_pipeline_succeeds?: boolean }>(req);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;
    if (!body.sha) {
      return NextResponse.json({ error: "sha is required" }, { status: 400 });
    }

    log.info(`Merging MR: project=${projectId} iid=${iid}`);

    const result = await gitlabFetch(
      `/projects/${projectId}/merge_requests/${iid}/merge`,
      token,
      {
        method: "PUT",
        body: {
          sha: body.sha,
          squash: body.squash,
          should_remove_source_branch: body.should_remove_source_branch,
          merge_when_pipeline_succeeds: body.merge_when_pipeline_succeeds,
        },
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleApiRouteError(error, log);
  }
}
