import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSession, getAccessToken, parseBody } from "@/lib/auth-helpers";
import { gitlabFetch } from "@/lib/gitlab-client";
import { validateNumericId, validateDiscussionId } from "@/lib/validation";
import { createLogger } from "@/lib/logger";
import { handleApiRouteError } from "@/lib/api-error-handler";
import { createNoteBodySchema } from "@/lib/schemas";

const log = createLogger("api/mr-discussion-notes");

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ projectId: string; iid: string; discussionId: string }> }
) {
  const params = await props.params;
  try {
    await getAuthenticatedSession();
    const token = await getAccessToken(req);
    const projectId = validateNumericId(params.projectId, "projectId");
    const iid = validateNumericId(params.iid, "iid");
    const discussionId = validateDiscussionId(params.discussionId);

    const parsed = await parseBody(req, createNoteBodySchema);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;

    log.info(`Replying to discussion: project=${projectId} iid=${iid} discussion=${discussionId}`);

    const note = await gitlabFetch(
      `/projects/${projectId}/merge_requests/${iid}/discussions/${discussionId}/notes`,
      token,
      { method: "POST", body: { body: body.body } },
    );

    return NextResponse.json(note);
  } catch (error) {
    return handleApiRouteError(error, log);
  }
}
