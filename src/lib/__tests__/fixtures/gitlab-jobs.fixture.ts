import type { GitLabJob } from "@/lib/types/gitlab";

export const MOCK_JOB: GitLabJob = {
  id: 301,
  name: "test",
  stage: "test",
  status: "success",
  duration: 120.5,
  web_url: "https://gitlab.example.com/org/project/-/jobs/301",
  created_at: "2025-01-15T10:00:00Z",
  started_at: "2025-01-15T10:01:00Z",
  finished_at: "2025-01-15T10:03:00Z",
};

export const MOCK_JOB_RUNNING: GitLabJob = {
  id: 302,
  name: "build",
  stage: "build",
  status: "running",
  duration: null,
  web_url: "https://gitlab.example.com/org/project/-/jobs/302",
  created_at: "2025-01-15T10:00:00Z",
  started_at: "2025-01-15T10:01:00Z",
  finished_at: null,
};

export const MOCK_JOB_TRACE_TEXT = [
  "Running with gitlab-runner 16.0.0",
  "Preparing the \"docker\" executor",
  "Using Docker executor with image node:20-alpine ...",
  "$ npm ci",
  "added 1234 packages in 15s",
  "$ npm test",
  "PASS src/lib/__tests__/example.test.ts",
  "  ✓ should pass (5ms)",
  "Test Suites: 1 passed, 1 total",
  "Tests: 1 passed, 1 total",
  "Job succeeded",
].join("\n");
