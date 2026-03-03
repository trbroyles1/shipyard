import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSession, getAccessToken, parseBody } from "@/lib/auth-helpers";
import { gitlabFetch, gitlabFetchAllPages } from "@/lib/gitlab-client";
import { validateNumericId } from "@/lib/validation";
import { createLogger } from "@/lib/logger";
import { handleApiRouteError } from "@/lib/api-error-handler";
import { createDiscussionBodySchema } from "@/lib/schemas";
import type { GitLabDiscussion } from "@/lib/types/gitlab";

const log = createLogger("api/mr-discussions");

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

    log.info(`Fetching MR discussions: project=${projectId} iid=${iid}`);

    const discussions = await gitlabFetchAllPages<GitLabDiscussion>(
      `/projects/${projectId}/merge_requests/${iid}/discussions`,
      token,
    );

    return NextResponse.json(discussions);
  } catch (error) {
    return handleApiRouteError(error, log);
  }
}

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ projectId: string; iid: string }> }
) {
  const params = await props.params;
  try {
    await getAuthenticatedSession();
    const token = await getAccessToken(req);
    const projectId = validateNumericId(params.projectId, "projectId");
    const iid = validateNumericId(params.iid, "iid");

    const parsed = await parseBody(req, createDiscussionBodySchema);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;

    log.info(`Creating discussion: project=${projectId} iid=${iid}`);

    const payload: Record<string, unknown> = { body: body.body };
    if (body.position) {
      payload.position = body.position;
    }

    const discussion = await gitlabFetch<GitLabDiscussion>(
      `/projects/${projectId}/merge_requests/${iid}/discussions`,
      token,
      { method: "POST", body: payload },
    );

    return NextResponse.json(discussion);
  } catch (error) {
    return handleApiRouteError(error, log);
  }
}
