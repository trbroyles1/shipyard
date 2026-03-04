import { describe, it, expect } from "vitest";
import { mapUser, mapPipeline, mapMRSummary } from "@/lib/types/mr";
import {
  MOCK_USER,
  MOCK_REVIEWER,
  MOCK_PIPELINE,
  MOCK_MERGE_REQUEST,
  MOCK_MERGE_REQUEST_MINIMAL,
} from "@/lib/__tests__/fixtures/gitlab-mr.fixture";

describe("mapUser", () => {
  it("maps GitLabUser to MRUser with camelCase properties", () => {
    const result = mapUser(MOCK_USER);
    expect(result).toEqual({
      id: MOCK_USER.id,
      username: MOCK_USER.username,
      name: MOCK_USER.name,
      avatarUrl: MOCK_USER.avatar_url,
      webUrl: MOCK_USER.web_url,
    });
  });

  it("maps a different user correctly", () => {
    const result = mapUser(MOCK_REVIEWER);
    expect(result).toEqual({
      id: MOCK_REVIEWER.id,
      username: MOCK_REVIEWER.username,
      name: MOCK_REVIEWER.name,
      avatarUrl: MOCK_REVIEWER.avatar_url,
      webUrl: MOCK_REVIEWER.web_url,
    });
  });
});

describe("mapPipeline", () => {
  it("maps GitLabPipeline to MRPipeline", () => {
    const result = mapPipeline(MOCK_PIPELINE);
    expect(result).toEqual({
      id: MOCK_PIPELINE.id,
      status: MOCK_PIPELINE.status,
      webUrl: MOCK_PIPELINE.web_url,
    });
  });

  it("returns null when pipeline is null", () => {
    expect(mapPipeline(null)).toBeNull();
  });
});

describe("mapMRSummary", () => {
  const REPO_SLUG = "project";
  const REPO_URL = "https://gitlab.example.com/org/project";

  it("maps a full merge request with all fields", () => {
    const result = mapMRSummary(MOCK_MERGE_REQUEST, REPO_SLUG, REPO_URL);

    expect(result.id).toBe(MOCK_MERGE_REQUEST.id);
    expect(result.iid).toBe(MOCK_MERGE_REQUEST.iid);
    expect(result.projectId).toBe(MOCK_MERGE_REQUEST.project_id);
    expect(result.title).toBe(MOCK_MERGE_REQUEST.title);
    expect(result.repo).toBe(REPO_SLUG);
    expect(result.repoUrl).toBe(REPO_URL);
    expect(result.draft).toBe(false);
    expect(result.createdAt).toBe(MOCK_MERGE_REQUEST.created_at);
    expect(result.updatedAt).toBe(MOCK_MERGE_REQUEST.updated_at);
    expect(result.sourceBranch).toBe(MOCK_MERGE_REQUEST.source_branch);
    expect(result.targetBranch).toBe(MOCK_MERGE_REQUEST.target_branch);
    expect(result.labels).toEqual(MOCK_MERGE_REQUEST.labels);
    expect(result.hasConflicts).toBe(false);
    expect(result.detailedMergeStatus).toBe(MOCK_MERGE_REQUEST.detailed_merge_status);
    expect(result.webUrl).toBe(MOCK_MERGE_REQUEST.web_url);
    expect(result.approvalsRequired).toBe(0);
    expect(result.approvalsGiven).toBe(0);
  });

  it("maps author using mapUser", () => {
    const result = mapMRSummary(MOCK_MERGE_REQUEST, REPO_SLUG, REPO_URL);
    expect(result.author).toEqual(mapUser(MOCK_USER));
  });

  it("maps assignees and reviewers arrays", () => {
    const result = mapMRSummary(MOCK_MERGE_REQUEST, REPO_SLUG, REPO_URL);
    expect(result.assignees).toHaveLength(1);
    expect(result.assignees[0]).toEqual(mapUser(MOCK_USER));
    expect(result.reviewers).toHaveLength(1);
    expect(result.reviewers[0]).toEqual(mapUser(MOCK_REVIEWER));
  });

  it("maps pipeline via mapPipeline", () => {
    const result = mapMRSummary(MOCK_MERGE_REQUEST, REPO_SLUG, REPO_URL);
    expect(result.pipeline).toEqual({
      id: MOCK_PIPELINE.id,
      status: MOCK_PIPELINE.status,
      webUrl: MOCK_PIPELINE.web_url,
    });
  });

  it("parses changes_count as integer", () => {
    const result = mapMRSummary(MOCK_MERGE_REQUEST, REPO_SLUG, REPO_URL);
    expect(result.changesCount).toBe(5);
  });

  it("maps a minimal/draft merge request with nulls and empty arrays", () => {
    const result = mapMRSummary(MOCK_MERGE_REQUEST_MINIMAL, REPO_SLUG, REPO_URL);

    expect(result.draft).toBe(true);
    expect(result.pipeline).toBeNull();
    expect(result.assignees).toEqual([]);
    expect(result.reviewers).toEqual([]);
    expect(result.hasConflicts).toBe(true);
    expect(result.changesCount).toBe(0);
  });

  it("handles changes_count: 'many' by falling back to 0", () => {
    const mrWithMany = { ...MOCK_MERGE_REQUEST, changes_count: "many" as string };
    const result = mapMRSummary(mrWithMany, REPO_SLUG, REPO_URL);
    expect(result.changesCount).toBe(0);
  });
});
