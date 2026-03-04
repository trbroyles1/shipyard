import type { GitLabCommit } from "@/lib/types/gitlab";

export const MOCK_COMMIT: GitLabCommit = {
  id: "abc123def456abc123def456abc123def456abc1",
  short_id: "abc123de",
  title: "Add user preferences panel",
  message: "Add user preferences panel\n\nImplements theme switching and locale selection.",
  author_name: "Jane Doe",
  author_email: "jdoe@example.com",
  authored_date: "2025-01-15T09:30:00Z",
  committer_name: "Jane Doe",
  committed_date: "2025-01-15T09:30:00Z",
  web_url: "https://gitlab.example.com/org/project/-/commit/abc123def456abc123def456abc123def456abc1",
};
