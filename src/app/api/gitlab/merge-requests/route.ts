import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSession, getAccessToken } from "@/lib/auth-helpers";
import { gitlabFetchAllPages } from "@/lib/gitlab-client";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import { handleApiRouteError } from "@/lib/api-error-handler";
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

export async function GET(req: NextRequest) {
  try {
    await getAuthenticatedSession();
    const token = await getAccessToken(req);

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
    return handleApiRouteError(error, log);
  }
}
