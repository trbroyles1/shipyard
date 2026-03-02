import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSession, extractAccessToken } from "@/lib/auth-helpers";
import { gitlabFetchAllPages } from "@/lib/gitlab-client";
import { createLogger } from "@/lib/logger";
import { handleApiRouteError } from "@/lib/api-error-handler";
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
    return handleApiRouteError(error, log);
  }
}
