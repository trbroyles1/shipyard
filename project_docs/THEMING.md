# Theming Architecture

## Overview
Shipyard themes are file-based and self-contained.

- Shared theme primitives stay in `src/styles/theme/{colors,typography,spacing,effects,layout}.css`.
- Theme-specific values live in `src/styles/theme/themes/*.css`.
- `src/styles/theme/tokens.css` is only an import aggregator for per-theme files.
- `src/styles/hljs-shipyard.css` contains only highlight.js class-to-variable mappings.
- Theme selection is driven by `data-theme` on `<html>`.

## Theme Files
Current themes:

- `src/styles/theme/themes/classic.css`
- `src/styles/theme/themes/brinjal.css`
- `src/styles/theme/themes/drydock.css`
- `src/styles/theme/themes/bermude.css`

Rules:

- `classic.css` must declare `:root, [data-theme="classic"]`.
- Every other theme file must declare `[data-theme="<theme-id>"]`.
- Each theme file must define the full required custom property set:
  - App design tokens (`--bg-*`, `--t*`, `--acc*`, semantic, layout/effects overrides, etc.)
  - Syntax tokens (`--hljs-*`)
- `color-scheme` is set in each theme file (`dark` for classic/brinjal/drydock, `light` for bermude).

## Theme Metadata
`src/lib/types/preferences.ts` is the source of truth for theme ids and labels.

- `THEMES` defines all available themes.
- `Theme` is derived from `THEMES`.
- `isTheme(value)` is the runtime guard for cookie/theme parsing.

## Validation
Run:

```bash
npm run check:themes
```

The validator (`scripts/validate-theme-css.mjs`) enforces:

- one file per registered theme id
- selector presence per theme file
- required `color-scheme`
- full app token and `--hljs-*` coverage in every theme file

## Adding a New Theme
1. Add a new entry to `THEMES` in `src/lib/types/preferences.ts`.
2. Create `src/styles/theme/themes/<theme-id>.css` with:
   - `[data-theme="<theme-id>"]` selector
   - full app token set
   - full `--hljs-*` token set
   - explicit `color-scheme`
3. Ensure `src/styles/theme/tokens.css` imports the new file.
4. Run `npm run check:themes` and `npm run lint`.
5. Verify in UI via Preferences theme switcher.
