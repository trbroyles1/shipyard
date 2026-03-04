import type { GitLabMergeRequest, GitLabUser, GitLabPipeline } from "./gitlab";

export interface MRSummary {
  id: number;
  iid: number;
  projectId: number;
  title: string;
  repo: string;
  repoUrl: string;
  author: MRUser;
  assignees: MRUser[];
  reviewers: MRUser[];
  draft: boolean;
  createdAt: string;
  updatedAt: string;
  sourceBranch: string;
  targetBranch: string;
  labels: string[];
  hasConflicts: boolean;
  detailedMergeStatus: string;
  pipeline: MRPipeline | null;
  approvalsRequired: number;
  approvalsGiven: number;
  changesCount: number;
  webUrl: string;
}

export interface MRUser {
  id: number;
  username: string;
  name: string;
  avatarUrl: string;
  webUrl: string;
}

export interface MRPipeline {
  id: number;
  status: string;
  webUrl: string;
}

export function mapUser(user: GitLabUser): MRUser {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    avatarUrl: user.avatar_url,
    webUrl: user.web_url,
  };
}

export function mapPipeline(pipeline: GitLabPipeline | null): MRPipeline | null {
  if (!pipeline) return null;
  return {
    id: pipeline.id,
    status: pipeline.status,
    webUrl: pipeline.web_url,
  };
}

export function mapMRSummary(mr: GitLabMergeRequest, repoSlug: string, repoUrl: string): MRSummary {
  return {
    id: mr.id,
    iid: mr.iid,
    projectId: mr.project_id,
    title: mr.title,
    repo: repoSlug,
    repoUrl,
    author: mapUser(mr.author),
    assignees: mr.assignees.map(mapUser),
    reviewers: mr.reviewers.map(mapUser),
    draft: mr.draft,
    createdAt: mr.created_at,
    updatedAt: mr.updated_at,
    sourceBranch: mr.source_branch,
    targetBranch: mr.target_branch,
    labels: mr.labels,
    hasConflicts: mr.has_conflicts,
    detailedMergeStatus: mr.detailed_merge_status,
    pipeline: mapPipeline(mr.head_pipeline),
    approvalsRequired: 0, // populated from approvals endpoint when needed
    approvalsGiven: 0,
    changesCount: Number.parseInt(mr.changes_count || "0", 10) || 0,
    webUrl: mr.web_url,
  };
}
