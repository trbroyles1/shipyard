import type { GitLabDiffFile, GitLabChangesResponse } from "@/lib/types/gitlab";

export const MOCK_DIFF_TEXT_FILE: GitLabDiffFile = {
  old_path: "src/utils/helpers.ts",
  new_path: "src/utils/helpers.ts",
  a_mode: "100644",
  b_mode: "100644",
  diff: [
    "@@ -1,10 +1,15 @@",
    " import { foo } from './foo';",
    "-import { bar } from './bar';",
    "+import { bar, baz } from './bar';",
    "+import { qux } from './qux';",
    " ",
    " export function helper() {",
    "-  return foo() + bar();",
    "+  const result = foo() + bar();",
    "+  return baz(result) + qux();",
    " }",
    " ",
    "+export function newHelper() {",
    "+  return 'new';",
    "+}",
    "+",
    " export const VALUE = 42;",
    "-export const OLD_VALUE = 0;",
    "+export const UPDATED_VALUE = 1;",
    " ",
    "+export const EXTRA = true;",
  ].join("\n"),
  new_file: false,
  renamed_file: false,
  deleted_file: false,
};

export const MOCK_DIFF_BINARY_FILE: GitLabDiffFile = {
  old_path: "assets/logo.png",
  new_path: "assets/logo.png",
  a_mode: "100644",
  b_mode: "120000",
  diff: "",
  new_file: false,
  renamed_file: false,
  deleted_file: false,
};

/** Generates a diff with > 1500 changed lines. */
function generateLargeDiff(): string {
  const lines: string[] = ["@@ -1,1 +1,1600 @@"];
  for (let i = 0; i < 1600; i++) {
    lines.push(`+const line${i} = ${i};`);
  }
  return lines.join("\n");
}

export const MOCK_DIFF_LARGE_FILE: GitLabDiffFile = {
  old_path: "src/generated/big.ts",
  new_path: "src/generated/big.ts",
  a_mode: "100644",
  b_mode: "100644",
  diff: generateLargeDiff(),
  new_file: true,
  renamed_file: false,
  deleted_file: false,
};

export const MOCK_DIFF_RENAMED_FILE: GitLabDiffFile = {
  old_path: "src/old-name.ts",
  new_path: "src/new-name.ts",
  a_mode: "100644",
  b_mode: "100644",
  diff: "@@ -1,3 +1,3 @@\n-export const A = 1;\n+export const A = 2;\n export const B = 3;\n",
  new_file: false,
  renamed_file: true,
  deleted_file: false,
};

export const MOCK_DIFF_NO_DIFF_TEXT: GitLabDiffFile = {
  old_path: "src/empty.ts",
  new_path: "src/empty.ts",
  a_mode: "100644",
  b_mode: "100644",
  diff: "",
  new_file: false,
  renamed_file: false,
  deleted_file: false,
};

export const MOCK_CHANGES_RESPONSE: GitLabChangesResponse = {
  changes: [MOCK_DIFF_TEXT_FILE, MOCK_DIFF_BINARY_FILE, MOCK_DIFF_RENAMED_FILE],
  overflow: false,
};

export const MOCK_CHANGES_OVERFLOW_RESPONSE: GitLabChangesResponse = {
  changes: [MOCK_DIFF_TEXT_FILE],
  overflow: true,
};
