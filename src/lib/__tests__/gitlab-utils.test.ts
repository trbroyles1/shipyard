import { describe, it, expect } from "vitest";
import { extractRepoSlug } from "@/lib/gitlab-utils";

describe("extractRepoSlug", () => {
  it("extracts slug and repoUrl from a standard GitLab MR URL", () => {
    const result = extractRepoSlug(
      "https://gitlab.com/org/project/-/merge_requests/42",
    );
    expect(result).toEqual({
      slug: "project",
      repoUrl: "https://gitlab.com/org/project",
    });
  });

  it("handles nested group paths", () => {
    const result = extractRepoSlug(
      "https://gitlab.com/org/sub-group/deep/project/-/merge_requests/99",
    );
    expect(result).toEqual({
      slug: "project",
      repoUrl: "https://gitlab.com/org/sub-group/deep/project",
    });
  });

  it("handles self-hosted GitLab instances", () => {
    const result = extractRepoSlug(
      "https://gitlab.example.com/team/repo/-/merge_requests/1",
    );
    expect(result).toEqual({
      slug: "repo",
      repoUrl: "https://gitlab.example.com/team/repo",
    });
  });

  it("handles HTTP URLs", () => {
    const result = extractRepoSlug(
      "http://gitlab.local/ns/app/-/merge_requests/5",
    );
    expect(result).toEqual({
      slug: "app",
      repoUrl: "http://gitlab.local/ns/app",
    });
  });

  it("handles slugs with special characters (hyphens, dots)", () => {
    const result = extractRepoSlug(
      "https://gitlab.com/org/my-cool.project/-/merge_requests/10",
    );
    expect(result).toEqual({
      slug: "my-cool.project",
      repoUrl: "https://gitlab.com/org/my-cool.project",
    });
  });

  it("returns fallback for non-matching URLs", () => {
    expect(extractRepoSlug("https://github.com/org/repo/pull/1")).toEqual({
      slug: "unknown",
      repoUrl: "",
    });
  });

  it("returns fallback for empty string", () => {
    expect(extractRepoSlug("")).toEqual({
      slug: "unknown",
      repoUrl: "",
    });
  });

  it("returns fallback for URL without merge_requests segment", () => {
    expect(extractRepoSlug("https://gitlab.com/org/project")).toEqual({
      slug: "unknown",
      repoUrl: "",
    });
  });
});
