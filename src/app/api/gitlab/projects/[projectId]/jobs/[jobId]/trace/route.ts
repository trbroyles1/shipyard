import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSession, getAccessToken } from "@/lib/auth-helpers";
import { env } from "@/lib/env";
import { acquire } from "@/lib/rate-limiter";
import { validateNumericId } from "@/lib/validation";
import { createLogger } from "@/lib/logger";
import { handleApiRouteError } from "@/lib/api-error-handler";
import {
  GITLAB_FETCH_TIMEOUT_MS,
  HEADER_JOB_STATUS,
  GITLAB_API_VERSION_PATH,
} from "@/lib/constants";

const log = createLogger("api/job-trace");

const RANGE_PATTERN = /^bytes=\d+-\d*$/;

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ projectId: string; jobId: string }> }
) {
  const params = await props.params;
  try {
    await getAuthenticatedSession();
    const token = await getAccessToken(req);
    const projectId = validateNumericId(params.projectId, "projectId");
    const jobId = validateNumericId(params.jobId, "jobId");

    log.info(`Fetching job trace: project=${projectId} job=${jobId}`);
    await acquire();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    // Forward Range header for incremental fetches
    const rangeHeader = req.headers.get("Range");
    if (rangeHeader && RANGE_PATTERN.test(rangeHeader)) {
      headers["Range"] = rangeHeader;
    }

    const response = await fetch(
      `${env.GITLAB_URL}${GITLAB_API_VERSION_PATH}/projects/${projectId}/jobs/${jobId}/trace`,
      { headers, signal: AbortSignal.timeout(GITLAB_FETCH_TIMEOUT_MS) },
    );

    if (!response.ok && response.status !== 206) {
      const errorBody = await response.text();
      log.error(`Job trace error ${response.status}: ${errorBody}`);
      return NextResponse.json(
        { error: "Failed to fetch job trace" },
        { status: response.status >= 500 ? 502 : response.status },
      );
    }

    const text = await response.text();

    // Forward content-range and expose job status from a separate call
    const contentRange = response.headers.get("Content-Range");

    // Fetch job status in parallel (we already acquired a rate-limit token)
    await acquire();
    const jobRes = await fetch(
      `${env.GITLAB_URL}${GITLAB_API_VERSION_PATH}/projects/${projectId}/jobs/${jobId}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(GITLAB_FETCH_TIMEOUT_MS) },
    );
    const jobStatus = jobRes.ok ? (await jobRes.json()).status : "unknown";

    const resHeaders: Record<string, string> = {
      "Content-Type": "text/plain",
      [HEADER_JOB_STATUS]: jobStatus,
    };
    if (contentRange) {
      resHeaders["Content-Range"] = contentRange;
    }

    return new NextResponse(text, {
      status: response.status,
      headers: resHeaders,
    });
  } catch (error) {
    return handleApiRouteError(error, log);
  }
}
