import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSession, getAccessToken } from "@/lib/auth-helpers";
import { gitlabFetchAllPages } from "@/lib/gitlab-client";
import { validateNumericId } from "@/lib/validation";
import { createLogger } from "@/lib/logger";
import { handleApiRouteError } from "@/lib/api-error-handler";
import type { GitLabNote } from "@/lib/types/gitlab";

const log = createLogger("api/mr-notes");

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
