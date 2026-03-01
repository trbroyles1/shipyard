import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSession, extractAccessToken, parseBody } from "@/lib/auth-helpers";
import { gitlabFetch, gitlabFetchAllPages, GitLabApiError } from "@/lib/gitlab-client";
import { createLogger } from "@/lib/logger";
import type { GitLabDiscussion } from "@/lib/types/gitlab";

const log = createLogger("api/mr-discussions");

export async function GET(
  _req: NextRequest,
  { params }: { params: { projectId: string; iid: string } },
) {
  try {
    const session = await getAuthenticatedSession();
    const token = extractAccessToken(session);
    const { projectId, iid } = params;

    log.info(`Fetching MR discussions: project=${projectId} iid=${iid}`);

    const discussions = await gitlabFetchAllPages<GitLabDiscussion>(
      `/projects/${projectId}/merge_requests/${iid}/discussions`,
      token,
    );

    return NextResponse.json(discussions);
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

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string; iid: string } },
) {
  try {
    const session = await getAuthenticatedSession();
    const token = extractAccessToken(session);
    const { projectId, iid } = params;

    const parsed = await parseBody<{ body?: string; position?: unknown }>(req);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;
    if (!body.body) {
      return NextResponse.json({ error: "body is required" }, { status: 400 });
    }

    log.info(`Creating discussion: project=${projectId} iid=${iid}`);

    const payload: Record<string, unknown> = { body: body.body };
    if (body.position) {
      payload.position = body.position;
    }

    const discussion = await gitlabFetch<GitLabDiscussion>(
      `/projects/${projectId}/merge_requests/${iid}/discussions`,
      token,
      { method: "POST", body: payload },
    );

    return NextResponse.json(discussion);
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
