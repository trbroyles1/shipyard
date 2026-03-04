import type { GitLabApprovals } from "@/lib/types/gitlab";
import { MOCK_USER } from "./gitlab-mr.fixture";

export const MOCK_APPROVALS: GitLabApprovals = {
  approved: true,
  approvals_required: 1,
  approvals_left: 0,
  approved_by: [{ user: MOCK_USER }],
};

export const MOCK_APPROVALS_EMPTY: GitLabApprovals = {
  approved: false,
  approvals_required: 2,
  approvals_left: 2,
  approved_by: [],
};
