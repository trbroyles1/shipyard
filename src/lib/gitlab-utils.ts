/** Shared GitLab URL parsing utilities. */

const MR_WEB_URL_RE = /^(https?:\/\/[^/]+\/(.+))\/-\/merge_requests\/\d+$/;

/**
 * Extract a short repo slug and the repository URL from a GitLab MR web_url.
 *
 * Example:
 *   "https://gitlab.com/org/project/-/merge_requests/42"
 *   → { slug: "project", repoUrl: "https://gitlab.com/org/project" }
 */
export function extractRepoSlug(webUrl: string): { slug: string; repoUrl: string } {
  const match = webUrl.match(MR_WEB_URL_RE);
  if (match) {
    const repoUrl = match[1];
    const fullPath = match[2];
    const slug = fullPath.split("/").pop() || fullPath;
    return { slug, repoUrl };
  }
  return { slug: "unknown", repoUrl: "" };
}
