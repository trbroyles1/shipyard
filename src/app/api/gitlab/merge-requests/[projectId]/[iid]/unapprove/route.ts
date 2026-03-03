import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSession, getAccessToken } from "@/lib/auth-helpers";
import { gitlabFetch } from "@/lib/gitlab-client";
import { validateNumericId } from "@/lib/validation";
import { createLogger } from "@/lib/logger";
import { handleApiRouteError } from "@/lib/api-error-handler";

const log = createLogger("api/mr-unapprove");

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

    log.info(`Unapproving MR: project=${projectId} iid=${iid}`);

    await gitlabFetch(
      `/projects/${projectId}/merge_requests/${iid}/unapprove`,
      token,
      { method: "POST" },
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiRouteError(error, log);
  }
}
