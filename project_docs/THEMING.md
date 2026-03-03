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
- `src/styles/theme/themes/myrtille.css`

Rules:

- `classic.css` must declare `:root, [data-theme="classic"]`.
- Every other theme file must declare `[data-theme="<theme-id>"]`.
- Each theme file must define the full required custom property set:
  - App design tokens (`--bg-*`, `--t*`, `--acc*`, semantic, layout/effects overrides, etc.)
  - Per-panel layout tokens (`--topbar-r`, `--topbar-sh`, `--sidebar-r`, `--sidebar-bg`, `--sidebar-sh`, `--main-inset`)
  - Button shadow (`--btn-shadow`)
  - Font family overrides (`--sans`, `--mono`)
  - Syntax tokens (`--hljs-*`)
- `color-scheme` is set in each theme file (`dark` for classic/brinjal/drydock/myrtille, `light` for bermude).

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

## Per-Panel Layout Tokens
Themes can control the radius, shadow, background, and inset of individual panels
rather than sharing a single `--panel-r`/`--panel-sh` value across all of them.

| Token | Purpose | Default (`:root`) |
|---|---|---|
| `--topbar-r` | Top bar border-radius | `0` |
| `--topbar-sh` | Top bar box-shadow | `none` |
| `--sidebar-r` | Sidebar border-radius | `0` |
| `--sidebar-bg` | Sidebar background | `transparent` |
| `--sidebar-sh` | Sidebar box-shadow | `none` |
| `--main-inset` | Margin around the main content panel | `0` |

Most themes alias these back to the shared tokens (e.g. `--topbar-r: var(--panel-r)`).
Themes like Myrtille use independent values to dock the topbar and sidebar flush while
floating the main content panel with inset spacing.

Defaults live in `src/styles/theme/layout.css`.

## Button Shadow
The `--btn-shadow` token controls depth/3D appearance on buttons globally.
It defaults to `none` in `src/styles/theme/effects.css` and is consumed by every
button-bearing CSS module. Themes can set it to a box-shadow value for tactile
button styling (e.g. Myrtille uses a multi-layer navy-tinted shadow).

## Dialog Background
The `--dialog-bg` token controls dialog/modal panel backgrounds. It defaults to
`var(--bg-s)` in `src/styles/theme/effects.css`, which is correct for opaque themes
where `--bg-s` is already solid. Glass-effect themes (Brinjal, Myrtille) override it
with a high-opacity variant of their `--bg-s` colour (~86–88% opacity) so that dialog
content remains readable over dense page content while preserving a subtle frosted
glass appearance from the existing `backdrop-filter` blur.

Consumed by `src/components/shared/Modal.module.css` and
`src/components/overview/MergeDialog.module.css`.

## Font Overrides
Each theme declares `--sans` and `--mono` tokens that control the application font
families. The pattern uses CSS `var()` fallback chains referencing `next/font` CSS
variables:

```css
--sans: var(--font-outfit, 'Outfit', sans-serif);
--mono: var(--font-jetbrains, 'JetBrains Mono', monospace);
```

To use a different font in a theme:

1. Import the font from `next/font/google` (or `next/font/local`) in `src/app/layout.tsx`.
2. Assign a `variable` option (e.g. `--font-plus-jakarta`).
3. Append `.variable` to the `<html>` className so the CSS variable is available.
4. Reference the new CSS variable in the theme file:
   ```css
   --sans: var(--font-plus-jakarta, 'Plus Jakarta Sans', sans-serif);
   ```

All theme fonts load unconditionally via `@font-face` at build time; the browser
only downloads woff2 files when a CSS rule actually references the font family,
so unused fonts cost nothing.

## Adding a New Theme
1. Add a new entry to `THEMES` in `src/lib/types/preferences.ts`.
2. Create `src/styles/theme/themes/<theme-id>.css` with:
   - `[data-theme="<theme-id>"]` selector
   - full app token set (including `--dialog-bg`, `--btn-shadow`, `--sans`, `--mono`, per-panel tokens)
   - full `--hljs-*` token set
   - explicit `color-scheme`
3. If the theme needs a custom font, add it to `src/app/layout.tsx` (see Font Overrides above).
4. Ensure `src/styles/theme/tokens.css` imports the new file.
5. Run `npm run check:themes` and `npm run lint`.
6. Verify in UI via Preferences theme switcher.
