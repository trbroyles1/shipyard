import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSession, extractAccessToken } from "@/lib/auth-helpers";
import { env } from "@/lib/env";
import { acquire } from "@/lib/rate-limiter";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/job-trace");

export async function GET(
  _req: NextRequest,
  { params }: { params: { projectId: string; jobId: string } },
) {
  try {
    const session = await getAuthenticatedSession();
    const token = extractAccessToken(session);
    const { projectId, jobId } = params;

    log.info(`Fetching job trace: project=${projectId} job=${jobId}`);
    await acquire();

    const response = await fetch(
      `${env.GITLAB_URL}/api/v4/projects/${projectId}/jobs/${jobId}/trace`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      log.error(`Job trace error ${response.status}: ${errorBody}`);
      return NextResponse.json({ error: errorBody }, { status: response.status });
    }

    const text = await response.text();
    return new NextResponse(text, {
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Not authenticated")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    log.error(`Unexpected error: ${error}`);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
