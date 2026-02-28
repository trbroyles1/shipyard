import { NextResponse } from "next/server";
import { getAuthenticatedSession, extractAccessToken } from "@/lib/auth-helpers";
import { gitlabFetchAllPages, GitLabApiError } from "@/lib/gitlab-client";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import type { GitLabMergeRequest } from "@/lib/types/gitlab";
import { mapMRSummary } from "@/lib/types/mr";

const log = createLogger("api/merge-requests");

function extractRepoSlug(webUrl: string): { slug: string; repoUrl: string } {
  // web_url looks like https://gitlab.com/group/subgroup/project/-/merge_requests/123
  const match = webUrl.match(/^(https?:\/\/[^/]+\/(.+))\/-\/merge_requests\/\d+$/);
  if (match) {
    const repoUrl = match[1];
    const fullPath = match[2];
    const slug = fullPath.split("/").pop() || fullPath;
    return { slug, repoUrl };
  }
  return { slug: "unknown", repoUrl: "" };
}

export async function GET() {
  try {
    const session = await getAuthenticatedSession();
    const token = extractAccessToken(session);

    log.info(`Fetching MRs for group ${env.GITLAB_GROUP_ID}`);

    const mrs = await gitlabFetchAllPages<GitLabMergeRequest>(
      `/groups/${env.GITLAB_GROUP_ID}/merge_requests`,
      token,
      {
        state: "opened",
        scope: "all",
        include_subgroups: "true",
      },
    );

    log.info(`Fetched ${mrs.length} open merge requests`);

    const summaries = mrs.map((mr) => {
      const { slug, repoUrl } = extractRepoSlug(mr.web_url);
      return mapMRSummary(mr, slug, repoUrl);
    });

    return NextResponse.json(summaries);
  } catch (error) {
    if (error instanceof GitLabApiError) {
      log.error(`GitLab API error: ${error.status} ${error.message}`);
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    if (error instanceof Error && error.message.includes("Not authenticated")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    log.error(`Unexpected error: ${error}`);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
