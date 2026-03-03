import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSession, getAccessToken } from "@/lib/auth-helpers";
import { gitlabFetch } from "@/lib/gitlab-client";
import { validateNumericId } from "@/lib/validation";
import { createLogger } from "@/lib/logger";
import { handleApiRouteError } from "@/lib/api-error-handler";
import type { GitLabDiffFile, EnrichedDiffFile } from "@/lib/types/gitlab";

const log = createLogger("api/mr-changes");

/** Diffs with more lines than this have their body stripped for the client. */
const LARGE_DIFF_LINE_THRESHOLD = 1500;

function countStats(diffText: string): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const line of diffText.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) additions++;
    else if (line.startsWith("-") && !line.startsWith("---")) deletions++;
  }
  return { additions, deletions };
}

function isBinaryMode(diff: GitLabDiffFile): boolean {
  const textModes = ["0", "100644", "100755"];
  return !textModes.includes(diff.a_mode) || !textModes.includes(diff.b_mode);
}

function enrichDiff(diff: GitLabDiffFile): EnrichedDiffFile {
  const binary = isBinaryMode(diff);

  if (binary) {
    return { ...diff, additions: 0, deletions: 0, truncated: false, binary: true };
  }

  if (!diff.diff) {
    // GitLab returned no diff text despite access_raw_diffs=true.
    // This shouldn't normally happen, but handle gracefully.
    return { ...diff, additions: 0, deletions: 0, truncated: false, binary: false };
  }

  const stats = countStats(diff.diff);
  const totalChanged = stats.additions + stats.deletions;

  if (totalChanged > LARGE_DIFF_LINE_THRESHOLD) {
    log.info(`Truncating large diff for ${diff.new_path} (${totalChanged} changed lines)`);
    return { ...diff, diff: "", ...stats, truncated: true, binary: false };
  }

  return { ...diff, ...stats, truncated: false, binary: false };
}

/**
 * GitLab's /changes endpoint returns the MR object with a `changes` array.
 * We use access_raw_diffs=true so GitLab doesn't collapse generated or large files.
 */
interface ChangesResponse {
  changes: GitLabDiffFile[];
  overflow: boolean;
}

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

    log.info(`Fetching MR changes: project=${projectId} iid=${iid}`);

    const result = await gitlabFetch<ChangesResponse>(
      `/projects/${projectId}/merge_requests/${iid}/changes?access_raw_diffs=true&per_page=100`,
      token,
    );

    if (result.overflow) {
      log.warn(`MR ${projectId}!${iid} has overflow — some files may be missing`);
    }

    const enriched = result.changes.map(enrichDiff);

    return NextResponse.json(enriched);
  } catch (error) {
    return handleApiRouteError(error, log);
  }
}
