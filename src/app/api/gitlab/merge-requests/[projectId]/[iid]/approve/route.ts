import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSession, extractAccessToken } from "@/lib/auth-helpers";
import { gitlabFetch, GitLabApiError } from "@/lib/gitlab-client";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/mr-approve");

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string; iid: string } },
) {
  try {
    const session = await getAuthenticatedSession();
    const token = extractAccessToken(session);
    const { projectId, iid } = params;

    const body = await req.json().catch(() => ({}));

    log.info(`Approving MR: project=${projectId} iid=${iid}`);

    await gitlabFetch(
      `/projects/${projectId}/merge_requests/${iid}/approve`,
      token,
      { method: "POST", body: body.sha ? { sha: body.sha } : undefined },
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
