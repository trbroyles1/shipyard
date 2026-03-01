import type { EnrichedDiffFile } from "@/lib/types/gitlab";

/** The client-side file type is just the server-enriched diff. */
export type FileWithStats = EnrichedDiffFile;
