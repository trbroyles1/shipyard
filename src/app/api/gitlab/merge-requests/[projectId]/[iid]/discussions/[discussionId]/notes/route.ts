import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSession, extractAccessToken, parseBody } from "@/lib/auth-helpers";
import { gitlabFetch, GitLabApiError } from "@/lib/gitlab-client";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/mr-discussion-notes");

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string; iid: string; discussionId: string } },
) {
  try {
    const session = await getAuthenticatedSession();
    const token = extractAccessToken(session);
    const { projectId, iid, discussionId } = params;

    const parsed = await parseBody<{ body?: string }>(req);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;
    if (!body.body) {
      return NextResponse.json({ error: "body is required" }, { status: 400 });
    }

    log.info(`Replying to discussion: project=${projectId} iid=${iid} discussion=${discussionId}`);

    const note = await gitlabFetch(
      `/projects/${projectId}/merge_requests/${iid}/discussions/${discussionId}/notes`,
      token,
      { method: "POST", body: { body: body.body } },
    );

    return NextResponse.json(note);
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
