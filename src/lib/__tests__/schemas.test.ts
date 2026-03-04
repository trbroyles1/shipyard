import { describe, it, expect } from "vitest";
import { ZodError } from "zod";

import {
  createDiscussionBodySchema,
  mergeBodySchema,
  approveBodySchema,
  resolveDiscussionBodySchema,
  createNoteBodySchema,
} from "@/lib/schemas";

const VALID_DIFF_POSITION = {
  position_type: "text" as const,
  base_sha: "abc123",
  head_sha: "def456",
  start_sha: "ghi789",
  old_path: "src/old.ts",
  new_path: "src/new.ts",
  old_line: 10,
  new_line: 15,
};

const VALID_LINE_RANGE = {
  start: { type: "new" as const, new_line: 1, old_line: null },
  end: { type: "new" as const, new_line: 5, old_line: null },
};

describe("createDiscussionBodySchema", () => {
  it("accepts minimal valid input (body only)", () => {
    const result = createDiscussionBodySchema.parse({ body: "comment text" });
    expect(result).toEqual({ body: "comment text" });
  });

  it("accepts body with position (no line_range)", () => {
    const input = { body: "review note", position: VALID_DIFF_POSITION };
    const result = createDiscussionBodySchema.parse(input);
    expect(result.body).toBe("review note");
    expect(result.position?.position_type).toBe("text");
    expect(result.position?.old_line).toBe(10);
    expect(result.position?.new_line).toBe(15);
  });

  it("accepts body with position including line_range", () => {
    const input = {
      body: "range comment",
      position: {
        ...VALID_DIFF_POSITION,
        line_range: VALID_LINE_RANGE,
      },
    };
    const result = createDiscussionBodySchema.parse(input);
    expect(result.position?.line_range?.start.type).toBe("new");
    expect(result.position?.line_range?.end.new_line).toBe(5);
  });

  it("accepts position with null old_line and new_line", () => {
    const input = {
      body: "null lines",
      position: { ...VALID_DIFF_POSITION, old_line: null, new_line: null },
    };
    const result = createDiscussionBodySchema.parse(input);
    expect(result.position?.old_line).toBeNull();
    expect(result.position?.new_line).toBeNull();
  });

  it("rejects missing body", () => {
    expect(() => createDiscussionBodySchema.parse({})).toThrow(ZodError);
  });

  it("rejects empty body string", () => {
    expect(() => createDiscussionBodySchema.parse({ body: "" })).toThrow(
      ZodError,
    );
  });

  it("rejects body with wrong type", () => {
    expect(() => createDiscussionBodySchema.parse({ body: 42 })).toThrow(
      ZodError,
    );
  });

  it("rejects position with missing required fields", () => {
    expect(() =>
      createDiscussionBodySchema.parse({
        body: "text",
        position: { position_type: "text" },
      }),
    ).toThrow(ZodError);
  });

  it("rejects position with invalid position_type", () => {
    expect(() =>
      createDiscussionBodySchema.parse({
        body: "text",
        position: { ...VALID_DIFF_POSITION, position_type: "image" },
      }),
    ).toThrow(ZodError);
  });

  it("rejects position with empty sha strings", () => {
    expect(() =>
      createDiscussionBodySchema.parse({
        body: "text",
        position: { ...VALID_DIFF_POSITION, base_sha: "" },
      }),
    ).toThrow(ZodError);
  });

  it("rejects line_range with invalid endpoint type", () => {
    expect(() =>
      createDiscussionBodySchema.parse({
        body: "text",
        position: {
          ...VALID_DIFF_POSITION,
          line_range: {
            start: { type: "invalid", new_line: 1, old_line: null },
            end: { type: "new", new_line: 5, old_line: null },
          },
        },
      }),
    ).toThrow(ZodError);
  });

  it("strips extra fields from the top level", () => {
    const result = createDiscussionBodySchema.parse({
      body: "text",
      extra: "field",
    });
    expect(result).toEqual({ body: "text" });
    expect("extra" in result).toBe(false);
  });

  it("strips extra fields from nested position", () => {
    const result = createDiscussionBodySchema.parse({
      body: "text",
      position: { ...VALID_DIFF_POSITION, bonus: "data" },
    });
    expect("bonus" in (result.position ?? {})).toBe(false);
  });
});

describe("mergeBodySchema", () => {
  it("accepts minimal valid input (sha only)", () => {
    const result = mergeBodySchema.parse({ sha: "abc123" });
    expect(result).toEqual({ sha: "abc123" });
  });

  it("accepts all optional fields", () => {
    const input = {
      sha: "abc123",
      squash: true,
      should_remove_source_branch: true,
      merge_when_pipeline_succeeds: false,
    };
    const result = mergeBodySchema.parse(input);
    expect(result).toEqual(input);
  });

  it("rejects missing sha", () => {
    expect(() => mergeBodySchema.parse({})).toThrow(ZodError);
  });

  it("rejects empty sha string", () => {
    expect(() => mergeBodySchema.parse({ sha: "" })).toThrow(ZodError);
  });

  it("rejects non-string sha", () => {
    expect(() => mergeBodySchema.parse({ sha: 123 })).toThrow(ZodError);
  });

  it("rejects non-boolean squash", () => {
    expect(() =>
      mergeBodySchema.parse({ sha: "abc", squash: "yes" }),
    ).toThrow(ZodError);
  });

  it("strips extra fields", () => {
    const result = mergeBodySchema.parse({ sha: "abc", unknown: true });
    expect("unknown" in result).toBe(false);
  });
});

describe("approveBodySchema", () => {
  it("accepts empty object", () => {
    const result = approveBodySchema.parse({});
    expect(result).toEqual({});
  });

  it("accepts object with sha", () => {
    const result = approveBodySchema.parse({ sha: "abc123" });
    expect(result).toEqual({ sha: "abc123" });
  });

  it("rejects non-string sha", () => {
    expect(() => approveBodySchema.parse({ sha: 123 })).toThrow(ZodError);
  });

  it("strips extra fields", () => {
    const result = approveBodySchema.parse({ extra: "field" });
    expect("extra" in result).toBe(false);
  });
});

describe("resolveDiscussionBodySchema", () => {
  it("accepts resolved: true", () => {
    const result = resolveDiscussionBodySchema.parse({ resolved: true });
    expect(result).toEqual({ resolved: true });
  });

  it("accepts resolved: false", () => {
    const result = resolveDiscussionBodySchema.parse({ resolved: false });
    expect(result).toEqual({ resolved: false });
  });

  it("rejects missing resolved", () => {
    expect(() => resolveDiscussionBodySchema.parse({})).toThrow(ZodError);
  });

  it("rejects non-boolean resolved", () => {
    expect(() =>
      resolveDiscussionBodySchema.parse({ resolved: "true" }),
    ).toThrow(ZodError);
  });

  it("strips extra fields", () => {
    const result = resolveDiscussionBodySchema.parse({
      resolved: true,
      extra: 1,
    });
    expect("extra" in result).toBe(false);
  });
});

describe("createNoteBodySchema", () => {
  it("accepts valid body", () => {
    const result = createNoteBodySchema.parse({ body: "a note" });
    expect(result).toEqual({ body: "a note" });
  });

  it("rejects missing body", () => {
    expect(() => createNoteBodySchema.parse({})).toThrow(ZodError);
  });

  it("rejects empty body string", () => {
    expect(() => createNoteBodySchema.parse({ body: "" })).toThrow(
      ZodError,
    );
  });

  it("rejects non-string body", () => {
    expect(() => createNoteBodySchema.parse({ body: true })).toThrow(
      ZodError,
    );
  });

  it("strips extra fields", () => {
    const result = createNoteBodySchema.parse({
      body: "note",
      extra: "data",
    });
    expect("extra" in result).toBe(false);
  });
});
