import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSession, getAccessToken, parseBody } from "@/lib/auth-helpers";
import { gitlabFetch } from "@/lib/gitlab-client";
import { validateNumericId } from "@/lib/validation";
import { createLogger } from "@/lib/logger";
import { handleApiRouteError } from "@/lib/api-error-handler";
import { mergeBodySchema } from "@/lib/schemas";

const log = createLogger("api/mr-merge");

export async function PUT(
  req: NextRequest,
  props: { params: Promise<{ projectId: string; iid: string }> }
) {
  const params = await props.params;
  try {
    await getAuthenticatedSession();
    const token = await getAccessToken(req);
    const projectId = validateNumericId(params.projectId, "projectId");
    const iid = validateNumericId(params.iid, "iid");

    const parsed = await parseBody(req, mergeBodySchema);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;

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
