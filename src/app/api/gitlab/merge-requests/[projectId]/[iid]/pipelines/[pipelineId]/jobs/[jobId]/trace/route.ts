import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSession, extractAccessToken } from "@/lib/auth-helpers";
import { env } from "@/lib/env";
import { acquire } from "@/lib/rate-limiter";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/job-trace");

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string; jobId: string } },
) {
  try {
    const session = await getAuthenticatedSession();
    const token = extractAccessToken(session);
    const { projectId, jobId } = params;

    log.info(`Fetching job trace: project=${projectId} job=${jobId}`);
    await acquire();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    // Forward Range header for incremental fetches
    const rangeHeader = req.headers.get("Range");
    if (rangeHeader) {
      headers["Range"] = rangeHeader;
    }

    const response = await fetch(
      `${env.GITLAB_URL}/api/v4/projects/${projectId}/jobs/${jobId}/trace`,
      { headers },
    );

    if (!response.ok && response.status !== 206) {
      const errorBody = await response.text();
      log.error(`Job trace error ${response.status}: ${errorBody}`);
      return NextResponse.json({ error: errorBody }, { status: response.status });
    }

    const text = await response.text();

    // Forward content-range and expose job status from a separate call
    const contentRange = response.headers.get("Content-Range");

    // Fetch job status in parallel (we already acquired a rate-limit token)
    await acquire();
    const jobRes = await fetch(
      `${env.GITLAB_URL}/api/v4/projects/${projectId}/jobs/${jobId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const jobStatus = jobRes.ok ? (await jobRes.json()).status : "unknown";

    const resHeaders: Record<string, string> = {
      "Content-Type": "text/plain",
      "X-Job-Status": jobStatus,
    };
    if (contentRange) {
      resHeaders["Content-Range"] = contentRange;
    }

    return new NextResponse(text, {
      status: response.status,
      headers: resHeaders,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Not authenticated")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    log.error(`Unexpected error: ${error}`);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
