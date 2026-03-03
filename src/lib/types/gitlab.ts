// GitLab API response shapes

export interface GitLabUser {
  id: number;
  username: string;
  name: string;
  avatar_url: string;
  web_url: string;
}

export interface GitLabPipeline {
  id: number;
  iid: number;
  status: "created" | "waiting_for_resource" | "preparing" | "pending" | "running" | "success" | "failed" | "canceled" | "skipped" | "manual" | "scheduled";
  ref: string;
  sha: string;
  web_url: string;
  created_at: string;
  updated_at: string;
}

export interface DiffRefs {
  base_sha: string;
  head_sha: string;
  start_sha: string;
}

export interface GitLabMergeRequest {
  id: number;
  iid: number;
  title: string;
  description: string | null;
  state: "opened" | "closed" | "merged" | "locked";
  draft: boolean;
  created_at: string;
  updated_at: string;
  source_branch: string;
  target_branch: string;
  author: GitLabUser;
  assignees: GitLabUser[];
  reviewers: GitLabUser[];
  labels: string[];
  milestone: { id: number; title: string } | null;
  has_conflicts: boolean;
  merge_status: string;
  detailed_merge_status: string;
  head_pipeline: GitLabPipeline | null;
  web_url: string;
  changes_count: string | null;
  user_notes_count: number;
  project_id: number;
  source_project_id: number;
  target_project_id: number;
  diff_refs: DiffRefs | null;
  references: {
    full: string;
    relative: string;
    short: string;
  };
}

export interface GitLabApprovals {
  approved: boolean;
  approvals_required: number;
  approvals_left: number;
  approved_by: { user: GitLabUser }[];
}

/** Position payload for creating diff-anchored discussions. */
export interface GitLabDiffPosition {
  position_type: "text";
  base_sha: string;
  head_sha: string;
  start_sha: string;
  old_path: string;
  new_path: string;
  old_line: number | null;
  new_line: number | null;
  line_range?: {
    start: { type: "new" | "old"; new_line: number | null; old_line: number | null };
    end: { type: "new" | "old"; new_line: number | null; old_line: number | null };
  };
}

export interface GitLabDiffFile {
  old_path: string;
  new_path: string;
  a_mode: string;
  b_mode: string;
  diff: string;
  new_file: boolean;
  renamed_file: boolean;
  deleted_file: boolean;
  /** Whether the diff was generated (true) or is truly binary with no text diff. */
  generated_file?: boolean;
}

/** Extended diff file returned by our API with precomputed stats. */
export interface EnrichedDiffFile extends GitLabDiffFile {
  additions: number;
  deletions: number;
  /** true when the diff body was stripped server-side to protect browser perf. */
  truncated: boolean;
  /** true when the file is genuinely binary (no text representation). */
  binary: boolean;
}

export interface GitLabNote {
  id: number;
  type: string | null;
  body: string;
  author: GitLabUser;
  created_at: string;
  updated_at: string;
  system: boolean;
  resolvable: boolean;
  resolved: boolean;
  resolved_by: GitLabUser | null;
  position?: {
    position_type: string;
    base_sha: string;
    head_sha: string;
    start_sha: string;
    old_path: string;
    new_path: string;
    old_line: number | null;
    new_line: number | null;
    line_range?: {
      start: { new_line: number | null; old_line: number | null };
      end: { new_line: number | null; old_line: number | null };
    };
  };
}

export interface GitLabDiscussion {
  id: string;
  individual_note: boolean;
  notes: GitLabNote[];
}

export interface GitLabCommit {
  id: string;
  short_id: string;
  title: string;
  message: string;
  author_name: string;
  author_email: string;
  authored_date: string;
  committer_name: string;
  committed_date: string;
  web_url: string;
}

export interface GitLabJob {
  id: number;
  name: string;
  stage: string;
  status: string;
  duration: number | null;
  web_url: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface GitLabChangesResponse {
  changes: GitLabDiffFile[];
  overflow: boolean;
}
