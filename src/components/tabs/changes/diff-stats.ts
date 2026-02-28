import type { GitLabDiffFile } from "@/lib/types/gitlab";

export interface DiffStats {
  additions: number;
  deletions: number;
}

/** Count added/removed lines from a unified diff string. */
export function countDiffStats(diffText: string | undefined): DiffStats {
  if (!diffText) return { additions: 0, deletions: 0 };
  let additions = 0;
  let deletions = 0;
  for (const line of diffText.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) additions++;
    else if (line.startsWith("-") && !line.startsWith("---")) deletions++;
  }
  return { additions, deletions };
}

export type FileWithStats = GitLabDiffFile & DiffStats;

export function enrichWithStats(diffs: GitLabDiffFile[]): FileWithStats[] {
  return diffs.map((d) => ({ ...d, ...countDiffStats(d.diff) }));
}
