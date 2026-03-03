# Code Quality Audit — Shipyard

## User Request

> conduct a code quality audit for this project.
> look for code smells, god objects, god functions, excessive use of hardcoded strings, anti-patterns for a NextJS app.
> assess how well the project conforms to norms for an AppRouter app.
> report on your findings.

## Executive Summary

The codebase is well-organized overall. Component decomposition, type safety, and the CSS token system are notably strong. The issues below are grouped by severity.

---

## CRITICAL — Dead Code / Functional Bugs

### 1. `proxy.ts` is dead code — no `middleware.ts` exists

> Annotation: this is likely out of date knowledge, attempting to apply NextJS 14 patterns to NextJS 16 which the app now uses. Confirm; if there's a real problem here fix it per NextJS 16 standards but I think this is a false flag.

`src/proxy.ts` exports an auth-wrapped middleware with inbound rate limiting, but Next.js requires a file named `middleware.ts` at `src/` root to pick it up. **No such file exists.** This means:

- Inbound rate limiting (`checkInboundRateLimit`) is never applied at the middleware layer
- The auth enforcement via the `auth()` wrapper in `proxy.ts` never runs
- Auth protection relies entirely on per-route `getAuthenticatedSession()` calls (which do work), but the rate limiter is completely bypassed

### 2. `use-discussion-actions.ts` — extracted but never wired up

> Annotation: Confirm this is accorate; fix if so.

The hook at `src/hooks/use-discussion-actions.ts` was created to deduplicate `handleReply`/`handleResolve`/`handleNewComment`, but **zero files import it**. Both `ChangesTab.tsx` and `DiscussionsTab.tsx` still carry their own inline copies.

### 3. Undefined CSS tokens in error pages

> Annotation: Confirm if accurate; if so fix using theme-appropriate colors per theme.

`global-error.module.css` and `not-found.module.css` reference `--fg-1`, `--fg-3`, and `--bg-1` — tokens that **do not exist** in any theme file. Text colors will resolve to nothing, making error pages unreadable.

---

## HIGH — Code Smells & Duplication

### 4. Jira text processing duplicated

> Annotation: fix

`JiraText.tsx` (lines 13-51) and `MarkdownBody.tsx` (lines 18-56) contain near-identical regex-scan-and-replace logic for JIRA ticket linking. Should be a shared function in `@/lib/jira-utils`.

### 5. `MarkdownBody.tsx` — `buildComponentMap` recreated every render

> Annotation: fix if doing so is not complex and brittle, otherwise deprioritize

`buildComponentMap()` returns a new 15-function object on every render. `ReactMarkdown` receives a new `components` prop reference each time, forcing full remounts. Should be wrapped in `useMemo`.

### 6. Clickable `div`s without keyboard accessibility

> Annotation: ignore

Multiple components use `<div onClick={...}>` for interactive elements with **no** `role="button"`, `tabIndex`, or `onKeyDown`:

- `MROverview.tsx:37` (overview toggle)
- `DiscussionThread.tsx:72` (thread toggle)
- `DiffViewer.tsx:296` (file header toggle)
- `PipelineTab.tsx:88` (pipeline row toggle)
- `MRCard.tsx:35` (MR selection)

### 7. No `aria-live` on dynamic status regions

> Annotation: ignore

Connection status bars in `Dashboard.tsx` and toast notifications in `ToastContainer.tsx` appear/disappear without `role="alert"` or `aria-live`, making them invisible to screen readers.

### 8. `DiffViewer.tsx` — 364 lines, too many responsibilities

> Annotation: ignore for now

Parses diffs, builds widget maps, manages gutter selection state, handles 3 async API calls via a co-located `InlineCommentForm`, and renders the full file header with inline SVGs. The widget-building and gutter logic should be extracted to hooks.

### 9. Inline SVGs duplicating `icons.tsx`

> Annotation: fix

Components inline SVGs that already exist in `src/components/shared/icons.tsx`:

- `Sidebar.tsx` — chevrons
- `DiffViewer.tsx` — chevron, file icon, comment bubble
- `FileTree.tsx` — close X, file icon, folder icon
- `PipelineTab.tsx` — external link, chevron, log icon
- `JobLogModal.tsx` — terminal, maximize/restore, close X
- `SortControl.tsx` — down-arrow

### 10. `extractRepoSlug` duplicated

> Annotation: fix

Exists canonically in `src/lib/gitlab-utils.ts` but re-declared locally in `src/app/api/gitlab/merge-requests/route.ts` (lines 12-22).

---

## MEDIUM — Anti-patterns & Inconsistencies

> Annotation: fix

### 11. `auth.ts` — `gitlabUrl()` duplicates `env.GITLAB_URL`

`auth.ts:13-15` has a local `gitlabUrl()` with the same `"https://gitlab.com"` fallback that `env.ts` provides. Two sources of truth; the `auth.ts` version silently uses the default without the warning that `env.ts` emits.

### 12. `auth-helpers.ts` — hardcoded error messages form implicit contracts

> Annotation: fix

`"Not authenticated"` thrown at lines 13 and 22 is matched by `api-error-handler.ts` via `includes()`. The string is also defined in `constants.ts` as `AUTH_ERROR_MESSAGES`. Neither throw site imports the constant — if the string changes, the contract silently breaks.

### 13. `mr-poller.ts` — auth-error handler block duplicated

> Annotation: ignore

Lines 205-209 and 222-226 are byte-for-byte identical (emit auth-expired SSE error, set `stopped = true`, return).

### 14. `rate-limiter.ts` — module-level state not HMR-safe

> Annotation: ignore

`tokens` and `lastRefill` are module-level `let` variables. Unlike `inbound-rate-limiter.ts` which uses `globalThis` + `Symbol.for()` to survive HMR, the outbound rate limiter resets on every hot reload in development.

### 15. `gitlab-client.ts` — `gitlabFetchAllPages` bypasses `gitlabFetch`

> Annotation: fix if low friction

`gitlabFetchAllPages` (line 157) rebuilds the base URL and auth header independently rather than calling `gitlabFetch`. Changes to URL construction or auth header format must be made in two places.

### 16. Unnecessary `'use client'` on presentational components

> Annotation: ignore

These components have no hooks, no event handlers, and no browser APIs — they're `'use client'` only because parent trees are client:

- `CommitsTab.tsx`, `HistoryTab.tsx`, `ToastContainer.tsx`, `NotificationBell.tsx`, `DescriptionBody.tsx`

### 17. `UIPanelProvider` — unrelated state causes unnecessary re-renders

> Annotation: ignore

Sidebar open/close, active tab, and `scrollToFile` signal are bundled in one context. Any state change re-renders all consumers. `scrollToFile` (used only by `ChangesTab`) should be a separate context.

### 18. `MermaidBlock.tsx` — theme hardcoded to `"dark"`

> Annotation: ignore

Line 19: `mod.default.initialize({ startOnLoad: false, theme: "dark" })`. The project has a light theme (Bermude). Mermaid diagrams will look wrong on it.

### 19. CSS — primary button pattern duplicated 7 times

> Annotation: ignore

`background: var(--acc); color: var(--acc-txt); border: var(--bw) solid var(--acc)` with hover `var(--acc-h)` appears in: `ActionButtons`, `MergeDialog`, `DiscussionsTab`, `DiffViewer`, `DiscussionThread`, `SessionDisplacedOverlay`, and `signin` modules.

### 20. CSS — `@keyframes spin` defined 3 times identically

> Annotation: ignore

In `MainContent.module.css`, `ActionButtons.module.css`, and `MergeDialog.module.css`.

### 21. CSS — empty state pattern duplicated in 5 tab modules

> Annotation: fix if low friction

`CommitsTab`, `PipelineTab`, `HistoryTab`, `ChangesTab`, `DiscussionsTab` all re-implement the empty state inline instead of using the `EmptyState` shared component.

### 22. `process.env.AUTH_SECRET` accessed directly in `api/sse/route.ts`

> Annotation: fix

Line 29 bypasses `env.AUTH_SECRET` (the typed lazy accessor that validates presence). Will silently pass `undefined` if the var is missing.

### 23. `discussions/resolve/route.ts` — no validation of `resolved` field

> Annotation: ignore

`body.resolved` is optional in the type and passed to GitLab even if `undefined`, sending an empty PUT body. Other mutation routes validate their required fields.

---

## LOW — Minor Issues

> Annotation: ignore all

| Issue | Location |
|---|---|
| `timeAgo` utility exported from client component file | `RelativeTime.tsx:15` — should be in `lib/` |
| `DescriptionBody` is a zero-value one-liner wrapper | `DescriptionBody.tsx` — adds a `<div>` + CSS class around `<JiraText>` |
| `Modal.tsx` has dead `el.close()` branch | `Modal.tsx:19-24` — early return on `!open` prevents the close path from executing |
| `PipelineTab` — two effects where one would do | Lines 70-84 — clears jobs in one effect just to trigger a refetch in another |
| `JobLogModal` — polling timer resets on every status change | Lines 81-96 — `liveStatus` in deps causes interval teardown/recreate per tick |
| `NotificationPanel` — reimplements click-outside | Lines 22-31 — uses raw `document.addEventListener` while `useClickOutside` hook exists |
| `handleCancel` trivial `useCallback` wrapper | `MergeDialog.tsx:31-33` — just calls `onClose()` |
| `global-error.module.css` uses `var(--font-outfit)` directly | Should use `var(--sans)` |
| `colors.css` utility classes are dead code | `.text-accent`, `.text-muted`, etc. — never referenced |
| `MRCard.module.css:17` — likely unnecessary `!important` | `.selected` override may no longer be needed |
| Pipeline status label maps duplicated across 3 files | `StatsRow`, `StatusDot`, `PipelineTab` each define their own |
| Raw `letter-spacing` values in 5 files without a token | 0.04em, 0.05em, 0.06em, 0.5px — the 0.05em ones should be `--ls-caps` |
| No z-index token scale | Raw values (1, 10, 50, 100, 200, 1000, 1100, 2000) with potential stacking conflicts at z=1000 |
| `body.body` naming stutter in discussion routes | `parsed.data` named `body` creates `body.body` reads |
| No `loading.tsx` or per-segment `error.tsx` | App Router Suspense/Error boundary features unused |
| No test infrastructure | No test runner or test files in the project |

---

## App Router Conformance Summary

| Convention | Status |
|---|---|
| `layout.tsx` at root | Present, async server component |
| `page.tsx` for routes | Present, server component with auth guard |
| `not-found.tsx` | Present |
| `global-error.tsx` | Present, correctly `'use client'` |
| API routes use `route.ts` | All correct |
| Async `params` (Next.js 15+) | All routes correctly `await params` |
| Auth via `getAuthenticatedSession()` per route | Consistently applied |
| `middleware.ts` | **Missing** — `proxy.ts` exists but is not picked up |
| `loading.tsx` per segment | Not used (loading handled in-component) |
| `error.tsx` per segment | Not used (only global error boundary) |
| Server components by default | Good — `'use client'` is on components that need it, with 5 unnecessary exceptions noted above |
| No `useEffect` for data fetching | Correct — all data fetching is server-side or in hooks via user interaction |

---

## What's Working Well

- **Component decomposition**: Clean feature-folder structure with co-located CSS modules. No god components except `DiffViewer`.
- **Type safety**: Strict TypeScript, typed env vars, typed API responses, proper use of discriminated unions for SSE events.
- **CSS token system**: Well-layered theme architecture with four themes that all pass the validation script.
- **API route consistency**: All 14+ routes follow the same pattern (auth check, validation, GitLab fetch, error handler).
- **Separation of concerns in `lib/`**: 20 focused modules with clear single responsibilities. No god modules.
- **Context providers**: Cleanly isolated in `providers/` folder, each managing one concern.
