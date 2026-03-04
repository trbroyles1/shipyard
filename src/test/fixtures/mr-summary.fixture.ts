import type { MRSummary, MRUser, MRPipeline } from "@/lib/types/mr";

const USER_SELF: MRUser = {
  id: 1,
  username: "jdoe",
  name: "Jane Doe",
  avatarUrl: "https://gitlab.example.com/avatar/1.png",
  webUrl: "https://gitlab.example.com/jdoe",
};

const USER_OTHER: MRUser = {
  id: 2,
  username: "rsmith",
  name: "Robert Smith",
  avatarUrl: "https://gitlab.example.com/avatar/2.png",
  webUrl: "https://gitlab.example.com/rsmith",
};

const USER_THIRD: MRUser = {
  id: 3,
  username: "alee",
  name: "Alice Lee",
  avatarUrl: "https://gitlab.example.com/avatar/3.png",
  webUrl: "https://gitlab.example.com/alee",
};

const SUCCESS_PIPELINE: MRPipeline = {
  id: 100,
  status: "success",
  webUrl: "https://gitlab.example.com/pipelines/100",
};

const RUNNING_PIPELINE: MRPipeline = {
  id: 101,
  status: "running",
  webUrl: "https://gitlab.example.com/pipelines/101",
};

/** Authored by user 1 (self), not a reviewer. */
export const MOCK_MR_AUTHORED: MRSummary = {
  id: 1001,
  iid: 17,
  projectId: 42,
  title: "Add user preferences panel",
  repo: "frontend/shipyard",
  repoUrl: "https://gitlab.example.com/frontend/shipyard",
  author: USER_SELF,
  assignees: [USER_SELF],
  reviewers: [USER_OTHER],
  draft: false,
  createdAt: "2025-01-14T09:00:00Z",
  updatedAt: "2025-01-15T11:00:00Z",
  sourceBranch: "feature/preferences",
  targetBranch: "main",
  labels: ["enhancement"],
  hasConflicts: false,
  detailedMergeStatus: "not_approved",
  pipeline: SUCCESS_PIPELINE,
  approvalsRequired: 2,
  approvalsGiven: 1,
  changesCount: 5,
  webUrl: "https://gitlab.example.com/frontend/shipyard/-/merge_requests/17",
};

/** Authored by user 2, user 1 is a reviewer. */
export const MOCK_MR_TO_REVIEW: MRSummary = {
  id: 1002,
  iid: 18,
  projectId: 43,
  title: "Fix login redirect loop",
  repo: "backend/auth-service",
  repoUrl: "https://gitlab.example.com/backend/auth-service",
  author: USER_OTHER,
  assignees: [USER_OTHER],
  reviewers: [USER_SELF, USER_THIRD],
  draft: false,
  createdAt: "2025-01-15T14:00:00Z",
  updatedAt: "2025-01-16T08:00:00Z",
  sourceBranch: "fix/login-redirect",
  targetBranch: "main",
  labels: ["bugfix"],
  hasConflicts: false,
  detailedMergeStatus: "not_approved",
  pipeline: SUCCESS_PIPELINE,
  approvalsRequired: 1,
  approvalsGiven: 0,
  changesCount: 3,
  webUrl: "https://gitlab.example.com/backend/auth-service/-/merge_requests/18",
};

/** Draft MR authored by user 2. */
export const MOCK_MR_DRAFT: MRSummary = {
  id: 1003,
  iid: 19,
  projectId: 42,
  title: "WIP: Refactor rate limiter",
  repo: "frontend/shipyard",
  repoUrl: "https://gitlab.example.com/frontend/shipyard",
  author: USER_OTHER,
  assignees: [],
  reviewers: [],
  draft: true,
  createdAt: "2025-01-16T10:00:00Z",
  updatedAt: "2025-01-16T10:30:00Z",
  sourceBranch: "refactor/rate-limiter",
  targetBranch: "main",
  labels: [],
  hasConflicts: true,
  detailedMergeStatus: "broken_status",
  pipeline: null,
  approvalsRequired: 1,
  approvalsGiven: 0,
  changesCount: 8,
  webUrl: "https://gitlab.example.com/frontend/shipyard/-/merge_requests/19",
};

/** Mergeable MR with passing pipeline. */
export const MOCK_MR_MERGEABLE: MRSummary = {
  id: 1004,
  iid: 20,
  projectId: 44,
  title: "Add CI badge to README",
  repo: "infra/ci-tools",
  repoUrl: "https://gitlab.example.com/infra/ci-tools",
  author: USER_THIRD,
  assignees: [USER_THIRD],
  reviewers: [USER_SELF],
  draft: false,
  createdAt: "2025-01-13T08:00:00Z",
  updatedAt: "2025-01-15T16:00:00Z",
  sourceBranch: "feature/ci-badge",
  targetBranch: "main",
  labels: ["infra", "docs"],
  hasConflicts: false,
  detailedMergeStatus: "mergeable",
  pipeline: RUNNING_PIPELINE,
  approvalsRequired: 1,
  approvalsGiven: 1,
  changesCount: 1,
  webUrl: "https://gitlab.example.com/infra/ci-tools/-/merge_requests/20",
};
