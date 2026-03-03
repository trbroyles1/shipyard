import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const preferencesPath = path.join(repoRoot, "src/lib/types/preferences.ts");
const themesDir = path.join(repoRoot, "src/styles/theme/themes");

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function extractThemeIds(source) {
  const matches = [...source.matchAll(/\{\s*value:\s*"([a-z0-9-]+)"/g)].map((m) => m[1]);
  return [...new Set(matches)];
}

function extractCustomProperties(cssSource) {
  return new Set([...cssSource.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
}

const errors = [];

const preferencesSource = readText(preferencesPath);
const themeIds = extractThemeIds(preferencesSource);

if (themeIds.length === 0) {
  errors.push(`Could not determine theme ids from ${path.relative(repoRoot, preferencesPath)}.`);
}

const themeFiles = new Map();
for (const themeId of themeIds) {
  const filePath = path.join(themesDir, `${themeId}.css`);
  if (!fs.existsSync(filePath)) {
    errors.push(`Missing theme file: ${path.relative(repoRoot, filePath)}.`);
    continue;
  }
  themeFiles.set(themeId, filePath);
}

const themeVariables = new Map();
for (const [themeId, filePath] of themeFiles) {
  const css = readText(filePath);
  themeVariables.set(themeId, extractCustomProperties(css));

  if (themeId === "classic") {
    if (!css.includes(":root") || !css.includes('[data-theme="classic"]')) {
      errors.push(
        `Theme ${themeId} must include both :root and [data-theme=\"classic\"] selectors in ${path.relative(repoRoot, filePath)}.`,
      );
    }
  } else if (!css.includes(`[data-theme="${themeId}"]`)) {
    errors.push(
      `Theme ${themeId} is missing selector [data-theme=\"${themeId}\"] in ${path.relative(repoRoot, filePath)}.`,
    );
  }

  const expectedColorScheme = themeId === "bermude" ? "light" : "dark";
  const colorSchemePattern = new RegExp(`color-scheme\\s*:\\s*${expectedColorScheme}\\s*;`);
  if (!colorSchemePattern.test(css)) {
    errors.push(
      `Theme ${themeId} must set color-scheme: ${expectedColorScheme} in ${path.relative(repoRoot, filePath)}.`,
    );
  }
}

const classicVars = themeVariables.get("classic");
if (!classicVars) {
  errors.push("Classic theme variables could not be loaded; cannot validate contract.");
}

const requiredAppVars = classicVars
  ? [...classicVars].filter((v) => !v.startsWith("--hljs-")).sort()
  : [];
const requiredHljsVars = classicVars
  ? [...classicVars].filter((v) => v.startsWith("--hljs-")).sort()
  : [];

if (requiredAppVars.length === 0) {
  errors.push("Classic theme is missing app design tokens (non --hljs-* custom properties).");
}
if (requiredHljsVars.length === 0) {
  errors.push("Classic theme is missing --hljs-* custom properties.");
}

for (const [themeId, vars] of themeVariables) {
  const missingApp = requiredAppVars.filter((v) => !vars.has(v));
  const missingHljs = requiredHljsVars.filter((v) => !vars.has(v));

  if (missingApp.length > 0) {
    errors.push(
      `Theme ${themeId} is missing app tokens (${missingApp.length}): ${missingApp.join(", ")}.`,
    );
  }

  if (missingHljs.length > 0) {
    errors.push(
      `Theme ${themeId} is missing hljs tokens (${missingHljs.length}): ${missingHljs.join(", ")}.`,
    );
  }
}

if (errors.length > 0) {
  console.error("Theme CSS validation failed:\n");
  for (const err of errors) {
    console.error(`- ${err}`);
  }
  process.exit(1);
}

console.log(
  `Theme CSS validation passed for ${themeIds.length} themes (${requiredAppVars.length} app tokens + ${requiredHljsVars.length} hljs tokens).`,
);
