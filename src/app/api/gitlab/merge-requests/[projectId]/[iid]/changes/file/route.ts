import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSession, getAccessToken } from "@/lib/auth-helpers";
import { gitlabFetch } from "@/lib/gitlab-client";
import { validateNumericId } from "@/lib/validation";
import { createLogger } from "@/lib/logger";
import { handleApiRouteError } from "@/lib/api-error-handler";
import type { GitLabChangesResponse } from "@/lib/types/gitlab";

const log = createLogger("api/mr-changes-file");

/**
 * Fetch the raw diff for a single file in an MR.
 * Query param: ?path=<file_path>
 * Uses /changes?access_raw_diffs=true so GitLab returns full content
 * even for collapsed/generated files.
 */
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
    const filePath = req.nextUrl.searchParams.get("path");

    if (!filePath) {
      return NextResponse.json({ error: "Missing ?path= query parameter" }, { status: 400 });
    }

    log.info(`Fetching single file diff: project=${projectId} iid=${iid} path=${filePath}`);

    const result = await gitlabFetch<GitLabChangesResponse>(
      `/projects/${projectId}/merge_requests/${iid}/changes?access_raw_diffs=true`,
      token,
    );

    const match = result.changes.find(
      (d) => d.new_path === filePath || d.old_path === filePath,
    );

    if (!match) {
      return NextResponse.json({ error: "File not found in MR diffs" }, { status: 404 });
    }

    return NextResponse.json({ diff: match.diff });
  } catch (error) {
    return handleApiRouteError(error, log);
  }
}
