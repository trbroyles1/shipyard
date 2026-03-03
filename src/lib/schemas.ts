import { z } from "zod";

const lineRangeEndpointSchema = z.object({
  type: z.enum(["new", "old"]),
  new_line: z.number().int().nullable(),
  old_line: z.number().int().nullable(),
});

const diffPositionSchema = z.object({
  position_type: z.literal("text"),
  base_sha: z.string().min(1),
  head_sha: z.string().min(1),
  start_sha: z.string().min(1),
  old_path: z.string().min(1),
  new_path: z.string().min(1),
  old_line: z.number().int().nullable(),
  new_line: z.number().int().nullable(),
  line_range: z
    .object({
      start: lineRangeEndpointSchema,
      end: lineRangeEndpointSchema,
    })
    .optional(),
});

/** POST /api/gitlab/merge-requests/[projectId]/[iid]/discussions */
export const createDiscussionBodySchema = z.object({
  body: z.string().min(1),
  position: diffPositionSchema.optional(),
});

/** PUT /api/gitlab/merge-requests/[projectId]/[iid]/merge */
export const mergeBodySchema = z.object({
  sha: z.string().min(1),
  squash: z.boolean().optional(),
  should_remove_source_branch: z.boolean().optional(),
  merge_when_pipeline_succeeds: z.boolean().optional(),
});

/** POST /api/gitlab/merge-requests/[projectId]/[iid]/approve */
export const approveBodySchema = z.object({
  sha: z.string().optional(),
});

/** PUT /api/gitlab/.../discussions/[discussionId]/resolve */
export const resolveDiscussionBodySchema = z.object({
  resolved: z.boolean(),
});

/** POST /api/gitlab/.../discussions/[discussionId]/notes */
export const createNoteBodySchema = z.object({
  body: z.string().min(1),
});
