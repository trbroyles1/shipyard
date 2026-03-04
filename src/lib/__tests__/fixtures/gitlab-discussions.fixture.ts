import type { GitLabNote, GitLabDiscussion } from "@/lib/types/gitlab";
import { MOCK_USER, MOCK_REVIEWER } from "./gitlab-mr.fixture";

export const MOCK_NOTE: GitLabNote = {
  id: 501,
  type: "DiffNote",
  body: "Looks good, but consider extracting this logic.",
  author: MOCK_USER,
  created_at: "2025-01-15T12:00:00Z",
  updated_at: "2025-01-15T12:00:00Z",
  system: false,
  resolvable: true,
  resolved: false,
  resolved_by: null,
  position: {
    position_type: "text",
    base_sha: "aaa111aaa111aaa111aaa111aaa111aaa111aaa1",
    head_sha: "bbb222bbb222bbb222bbb222bbb222bbb222bbb2",
    start_sha: "ccc333ccc333ccc333ccc333ccc333ccc333ccc3",
    old_path: "src/utils/helpers.ts",
    new_path: "src/utils/helpers.ts",
    old_line: null,
    new_line: 10,
  },
};

export const MOCK_SYSTEM_NOTE: GitLabNote = {
  id: 502,
  type: null,
  body: "mentioned in commit abc123",
  author: MOCK_REVIEWER,
  created_at: "2025-01-15T13:00:00Z",
  updated_at: "2025-01-15T13:00:00Z",
  system: true,
  resolvable: false,
  resolved: false,
  resolved_by: null,
};

export const MOCK_DISCUSSION: GitLabDiscussion = {
  id: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  individual_note: false,
  notes: [MOCK_NOTE],
};

export const MOCK_DISCUSSION_RESOLVED: GitLabDiscussion = {
  id: "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3",
  individual_note: false,
  notes: [
    {
      ...MOCK_NOTE,
      id: 503,
      resolved: true,
      resolved_by: MOCK_REVIEWER,
    },
  ],
};
