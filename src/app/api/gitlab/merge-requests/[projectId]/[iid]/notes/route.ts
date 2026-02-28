import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSession, extractAccessToken } from "@/lib/auth-helpers";
import { gitlabFetchAllPages, GitLabApiError } from "@/lib/gitlab-client";
import { createLogger } from "@/lib/logger";
import type { GitLabNote } from "@/lib/types/gitlab";

const log = createLogger("api/mr-notes");

export async function GET(
  _req: NextRequest,
  { params }: { params: { projectId: string; iid: string } },
) {
  try {
    const session = await getAuthenticatedSession();
    const token = extractAccessToken(session);
    const { projectId, iid } = params;

    log.info(`Fetching MR notes: project=${projectId} iid=${iid}`);

    const notes = await gitlabFetchAllPages<GitLabNote>(
      `/projects/${projectId}/merge_requests/${iid}/notes`,
      token,
      { sort: "asc" },
    );

    return NextResponse.json(notes);
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
