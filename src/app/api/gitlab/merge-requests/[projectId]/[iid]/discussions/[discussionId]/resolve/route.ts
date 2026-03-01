import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSession, extractAccessToken } from "@/lib/auth-helpers";
import { gitlabFetch, GitLabApiError } from "@/lib/gitlab-client";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/mr-discussion-resolve");

export async function PUT(
  req: NextRequest,
  { params }: { params: { projectId: string; iid: string; discussionId: string } },
) {
  try {
    const session = await getAuthenticatedSession();
    const token = extractAccessToken(session);
    const { projectId, iid, discussionId } = params;

    const body = await req.json();

    log.info(`${body.resolved ? "Resolving" : "Unresolving"} discussion: project=${projectId} iid=${iid} discussion=${discussionId}`);

    await gitlabFetch(
      `/projects/${projectId}/merge_requests/${iid}/discussions/${discussionId}`,
      token,
      { method: "PUT", body: { resolved: body.resolved } },
    );

    return NextResponse.json({ success: true });
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
