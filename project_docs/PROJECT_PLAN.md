# Shipyard — Implementation Plan

## Context

Shipyard is a dark-mode, single-pane-of-glass dashboard for managing GitLab merge request reviews. The user wants to see all MR information and perform all MR actions (approve, request changes, merge, comment) without ever leaving the app or triggering a full page reload. The project targets gitlab.com, runs as a Docker container, and must work without any GitLab-side configuration (no webhooks). All research is complete and documented in `project_docs/RESEARCH_NOTEBOOK.md`.

---

## Directory Structure

```
shipyard/
  project_docs/                    # Existing research artifacts
  package.json
  next.config.ts
  tsconfig.json
  .env.example
  Dockerfile
  docker-compose.yml
  .dockerignore
  .gitignore

  public/
    favicon.ico

  src/
    app/
      layout.tsx                   # Root layout: fonts, global CSS, SessionProvider
      page.tsx                     # Main dashboard (requires auth)
      globals.css                  # Imports theme files, resets, scrollbar
      api/
        auth/[...nextauth]/route.ts
        sse/route.ts               # SSE endpoint
        health/route.ts
        gitlab/
          merge-requests/route.ts                          # GET: list MRs
          merge-requests/[projectId]/[iid]/route.ts        # GET: MR detail
          merge-requests/[projectId]/[iid]/approve/route.ts
          merge-requests/[projectId]/[iid]/unapprove/route.ts
          merge-requests/[projectId]/[iid]/merge/route.ts
          merge-requests/[projectId]/[iid]/changes/route.ts
          merge-requests/[projectId]/[iid]/discussions/route.ts
          merge-requests/[projectId]/[iid]/discussions/[discussionId]/notes/route.ts
          merge-requests/[projectId]/[iid]/discussions/[discussionId]/resolve/route.ts
          merge-requests/[projectId]/[iid]/commits/route.ts
          merge-requests/[projectId]/[iid]/pipelines/route.ts
          merge-requests/[projectId]/[iid]/pipelines/[pipelineId]/jobs/route.ts
          merge-requests/[projectId]/[iid]/pipelines/[pipelineId]/jobs/[jobId]/trace/route.ts
          merge-requests/[projectId]/[iid]/notes/route.ts
          review-state/route.ts    # POST: GraphQL mutation for request-changes
        jira/issue/[key]/route.ts  # Phase 7

    lib/
      auth.ts                      # Auth.js v5 config: GitLab provider, JWT callbacks, token refresh
      auth-helpers.ts              # getAuthenticatedSession, extractAccessToken
      gitlab-client.ts             # Authenticated REST fetch wrapper + rate limiter integration
      gitlab-graphql.ts            # Authenticated GraphQL client (for request-changes)
      rate-limiter.ts              # Token-bucket rate limiter (module singleton)
      mr-store.ts                  # In-memory MR state Map (module singleton)
      mr-poller.ts                 # Polling loop: fetch, diff, emit transitions
      sse-broadcaster.ts           # Set<Controller>, broadcast events to SSE clients
      logger.ts                    # Leveled logger: plain text to stdout (server) / console (browser)
      env.ts                       # Typed env var access with validation
      jira-client.ts               # Phase 7
      types/
        gitlab.ts                  # GitLab API response interfaces
        mr.ts                      # Internal MR model + mapping functions
        events.ts                  # SSE event type definitions
        preferences.ts             # User preferences shape

    hooks/
      use-sse.ts                   # EventSource connection, typed event dispatch
      use-mr-list.ts               # MR list state from SSE + initial fetch
      use-mr-detail.ts             # Detail for selected MR (parallel fetches)
      use-preferences.ts           # Read/write preferences cookie
      use-notifications.ts         # Notification list, read timestamp, unread count
      use-audio.ts                 # AudioContext lifecycle, chime functions
      use-toasts.ts                # Toast queue with auto-dismiss

    components/
      providers/
        SessionProvider.tsx
        AppStateProvider.tsx        # React context: selected MR, filter, sort, SSE state
      layout/
        TopBar.tsx, Sidebar.tsx, MainContent.tsx
      sidebar/
        FilterTabs.tsx, SortControl.tsx, MRCard.tsx, MRList.tsx
      overview/
        MROverview.tsx, ActionButtons.tsx, BranchIndicator.tsx, LabelPills.tsx, StatsRow.tsx
      tabs/
        TabBar.tsx, ChangesTab.tsx, CommitsTab.tsx, DiscussionsTab.tsx, PipelineTab.tsx, HistoryTab.tsx
      diff/
        FileTree.tsx, DiffContainer.tsx, FileDiffSection.tsx, DiffRenderer.tsx
        InlineCommentThread.tsx, AddCommentButton.tsx, NewCommentForm.tsx
      pipeline/
        StageVisualization.tsx, JobLogViewer.tsx
      discussions/
        DiscussionThread.tsx, NoteItem.tsx, ReplyInput.tsx, NewCommentInput.tsx
      history/
        Timeline.tsx, TimelineEvent.tsx
      notifications/
        NotificationBell.tsx, NotificationPanel.tsx, ToastContainer.tsx, Toast.tsx
      user/
        UserMenu.tsx, PreferencesModal.tsx
      jira/
        JiraLink.tsx, JiraPopup.tsx (Phase 7)
      shared/
        Avatar.tsx, StatusDot.tsx, RelativeTime.tsx, GitLabLink.tsx
        EmptyState.tsx, Modal.tsx, CollapsiblePanel.tsx

    styles/
      theme/
        tokens.css, colors.css, typography.css, spacing.css
      components/
        *.module.css               # Per-component CSS modules
```

---

## Phase 1: Project Bootstrap + Auth + MR List

**Goal:** Sign in via GitLab OAuth, see a live sidebar of open MRs, filter/sort, select one.

### 1.1 Project initialization
- `package.json`: next@14, react@18, typescript, next-auth@5 (Auth.js v5)
- `tsconfig.json`: paths alias `@/*` → `src/*`
- `next.config.ts`: `output: 'standalone'` for Docker
- `.env.example`: `AUTH_SECRET`, `GITLAB_CLIENT_ID`, `GITLAB_CLIENT_SECRET`, `GITLAB_URL`, `GITLAB_GROUP_ID`, `LOG_LEVEL`

### 1.2 Auth.js v5 with GitLab provider
- `src/lib/auth.ts`: GitLab provider, `session: { strategy: "jwt" }`, `jwt` callback stores access/refresh tokens + expires_at. Token refresh with rotation handling (mutex to prevent concurrent refresh races). Scopes: `['api']`.
- `src/lib/auth-helpers.ts`: `getAuthenticatedSession()` (throws if unauthed), `extractAccessToken(session)`.
- `src/app/api/auth/[...nextauth]/route.ts`: Auth.js catch-all.
- `src/lib/env.ts`: typed env vars, validates at startup.
- `src/lib/logger.ts`: leveled logger (`[LEVEL] [timestamp] [module]` to stdout). Configurable via `LOG_LEVEL`.

### 1.3 GitLab API client + types
- `src/lib/gitlab-client.ts`: `gitlabFetch(path, token, options?)` with auth header, rate limiter check, error handling (401/429/4xx/5xx), pagination helper.
- `src/lib/rate-limiter.ts`: token-bucket, 2,000 req/min, `acquire()` blocks/queues when over budget, warns at 80% utilization.
- `src/lib/types/gitlab.ts`: TypeScript interfaces for all GitLab API response shapes.
- `src/lib/types/mr.ts`: internal `MRSummary` / `MRDetail` models, mapping functions from GitLab types.
- `src/lib/types/events.ts`: SSE event type definitions.

### 1.4 MR list API route
- `src/app/api/gitlab/merge-requests/route.ts`: GET → calls `GET /groups/:id/merge_requests?state=opened&scope=all&include_subgroups=true&per_page=100`, maps to `MRSummary[]`.

### 1.5 Dark theme foundation + root layout
- `src/styles/theme/tokens.css`: CSS custom properties from mockup `:root` (colors, spacing, radii).
- `src/styles/theme/colors.css`, `typography.css`, `spacing.css`: extended definitions.
- `src/app/globals.css`: imports theme files, resets, dark background, scrollbar.
- `src/app/layout.tsx`: fonts via `next/font/google` (Outfit, JetBrains Mono), `<SessionProvider>`, imports globals.css.

### 1.6 App shell components
- `SessionProvider.tsx`, `AppStateProvider.tsx` (context: selectedMR, filter, sort).
- `TopBar.tsx`: 52px fixed bar, anchor icon + gradient "Shipyard", bell (placeholder), user icon + sign out.
- `Sidebar.tsx`: 340px collapsible, contains filter/sort/list.
- `MainContent.tsx`: renders EmptyState or detail.
- Shared: `Avatar.tsx`, `StatusDot.tsx`, `RelativeTime.tsx`, `GitLabLink.tsx`, `EmptyState.tsx`.

### 1.7 MR list sidebar
- `FilterTabs.tsx`: Mine / To Review / All Open.
- `SortControl.tsx`: count + sort toggle (age/repo, asc/desc).
- `MRCard.tsx`: repo:title, draft/ready status, metadata row, age-based background tinting.
- `MRList.tsx`: scrollable filtered+sorted cards.
- `use-mr-list.ts`: fetches `/api/gitlab/merge-requests` on mount. (SSE wired in Phase 3.)

### 1.8 Main page
- `src/app/page.tsx`: server component, auth check (redirect if unauthed), renders shell.

**Deliverable:** User signs in with GitLab, sees MR list sidebar, can filter/sort/select. Main area shows empty state.

---

## Phase 2: MR Detail + Read-Only Tabs

**Goal:** Selecting an MR loads full detail. All five tabs render in read-only mode.

### 2.1 Detail API routes
- `[projectId]/[iid]/route.ts` GET: MR detail + approvals.
- `.../changes/route.ts` GET: diffs (paginated).
- `.../discussions/route.ts` GET: all discussions.
- `.../commits/route.ts` GET: commit list.
- `.../pipelines/route.ts` GET: pipelines for MR.
- `.../pipelines/[pipelineId]/jobs/route.ts` GET: jobs in pipeline.
- `.../pipelines/[pipelineId]/jobs/[jobId]/trace/route.ts` GET: job log (Range header support).
- `.../notes/route.ts` GET: all notes (system notes for history).

### 2.2 Detail hook
- `use-mr-detail.ts`: on selected MR change, fires 6 parallel fetches (detail, diffs, discussions, commits, pipelines, notes). Exposes loaded data + isLoading.

### 2.3 Overview panel
- `MROverview.tsx`: collapsible, header `!{iid} · {repo}`. Expanded: title, branch indicator, description with JIRA pattern detection (links only), label/status pills, stats row, action buttons (disabled except "Open in GitLab").
- `BranchIndicator.tsx`, `LabelPills.tsx`, `StatsRow.tsx`, `ActionButtons.tsx`.
- `JiraLink.tsx`: detects `PROJ-1234` patterns, renders as external links to JIRA web UI.

### 2.4 Tab bar
- `TabBar.tsx`: Changes (file count), Commits, Discussions (thread count), Pipeline, History (event count). Accent underline on active tab.

### 2.5 Changes tab (diff viewer)
Dependencies: `react-diff-view`, `highlight.js`

- `ChangesTab.tsx`: orchestrates file tree + diff container.
- `FileTree.tsx`: 220px collapsible, directory structure, `+N/-N` stats, click→scroll, scroll-spy via IntersectionObserver.
- `DiffContainer.tsx`: scrollable area, one `FileDiffSection` per file.
- `FileDiffSection.tsx`: sticky header + collapse toggle. `content-visibility: auto`.
- `DiffRenderer.tsx`: parses unified diff via `parseDiff`, renders `<Diff viewType="unified">` + `<Hunk>`, syntax highlighting via highlight.js `tokenize()`, existing inline comments as read-only widgets.
- `InlineCommentThread.tsx`: renders thread below diff line. Notes with avatar/author/time/body. Resolved badge. Reply input placeholder.

### 2.6 Commits tab
- `CommitsTab.tsx`: SHA (linked to GitLab), message, author (linked), timestamp.

### 2.7 Discussions tab
- `DiscussionsTab.tsx`, `DiscussionThread.tsx`, `NoteItem.tsx`, `ReplyInput.tsx` (placeholder), `NewCommentInput.tsx` (placeholder).

### 2.8 Pipeline tab
Dependency: `ansi_up`

- `PipelineTab.tsx`: header with pipeline ID/status, stage visualization, job log viewer.
- `StageVisualization.tsx`: horizontal stage cards with connectors. Click to select.
- `JobLogViewer.tsx`: monospace log, ANSI→HTML via `ansi_up`, line numbers. (Streaming added in Phase 3.)

### 2.9 History tab
- `HistoryTab.tsx`, `Timeline.tsx`, `TimelineEvent.tsx`: vertical timeline, newest-first, color-coded dots (cyan=opened, green=approved/resolved, yellow=comment, gray=commit, orange=pipeline).

**Deliverable:** Full read-only MR review. Diffs with syntax highlighting, inline comments visible, commits, discussions, pipeline with job logs, history timeline.

---

## Phase 3: Real-Time Updates (SSE + Polling + Notifications + Audio)

**Goal:** Dashboard updates live without manual refresh. Toast notifications and chimes for key events.

### 3.1 In-memory MR store + poller
- `mr-store.ts`: module-singleton `Map<string, MRSummary>`. `getAll()`, `get()`, `upsert()`, `remove()`, `isHydrated` flag.
- `mr-poller.ts`: 20-30s interval. Fetches group MR list. Diffs against store:
  - New MR → `mr-new` event.
  - Removed MR → `mr-removed` event.
  - Changed MR → `mr-update` event.
  - `detailed_merge_status` transition to `mergeable` → `mr-ready-to-merge` event.
  - First poll: populate silently, no events. Set `isHydrated = true`.

### 3.2 SSE broadcaster + route
- `sse-broadcaster.ts`: `Set<Controller>` with user ID tracking. `broadcast()`, `broadcastToUser()`.
- `src/app/api/sse/route.ts`: GET → authenticates, returns ReadableStream with SSE headers. Registers controller. Sends initial status event. Starts poller on first connection (lazy init).

### 3.3 Client-side SSE
- `use-sse.ts`: EventSource to `/api/sse`. Dispatches typed events to handlers. Logs reconnections.
- Update `use-mr-list.ts`: subscribe to SSE events, merge updates into list state in real-time.

### 3.4 Notifications
- `use-notifications.ts`: in-memory list (last 50), `notificationsReadAt` cookie, `unreadCount`, `markAllRead()`.
- `NotificationBell.tsx`: red dot when unread > 0, opens panel.
- `NotificationPanel.tsx`: 320px dropdown, recent notifications, marks read on open.
- `ToastContainer.tsx` + `Toast.tsx`: bottom-right, slide-in, auto-dismiss 4s.
- `use-toasts.ts`: queue with auto-dismiss timer.

### 3.5 Audio chimes
- `use-audio.ts`: lazy AudioContext on first gesture. Three chime functions:
  - `playNewMR()`: sine 880Hz, 250ms.
  - `playAssignedToMe()`: two tones 880Hz→1100Hz, 150ms each.
  - `playReadyToMerge()`: triangle 660Hz, 400ms.
  - Check `audioContext.state`, resume if suspended. Respects `soundEnabled` pref.

### 3.6 Wire SSE events to notifications
- `mr-new` + `newMRNotif` pref → toast + `playNewMR()`. If assigned to current user as reviewer + `assignedNotif` → `playAssignedToMe()`.
- `mr-ready-to-merge` + `readyNotif` + MR author is current user → toast + `playReadyToMerge()`.

### 3.7 Streaming job logs
- Update `JobLogViewer.tsx`: poll `/api/gitlab/.../trace` every 3s with `Range: bytes=N-` while job is running. Append new content. Stop when job completes.

**Deliverable:** Live-updating dashboard. MRs appear/disappear/change in real-time. Toasts + chimes for new MRs, assignments, merge-ready.

---

## Phase 4: Write Actions (Approve, Request Changes, Merge, Comments)

**Goal:** Full interactive MR review — approve, request changes, merge, comment, reply, resolve.

### 4.1 Approve / Unapprove
- `.../approve/route.ts` POST: calls GitLab `POST .../approve` with sha safety check.
- `.../unapprove/route.ts` POST: calls GitLab `POST .../unapprove`.
- Wire `ActionButtons.tsx`: Approve/Unapprove toggle. Optimistic UI. Error toast on failure.

### 4.2 Request Changes (GraphQL)
- `gitlab-graphql.ts`: authenticated GraphQL client for `GITLAB_URL/api/graphql`.
- `review-state/route.ts` POST: `mergeRequestSetReviewState` mutation.
- Wire `ActionButtons.tsx`: "Request Changes" button.

### 4.3 Merge
- `.../merge/route.ts` PUT: calls GitLab with sha, squash, should_remove_source_branch, merge_when_pipeline_succeeds.
- Wire `ActionButtons.tsx`: Merge button with options dropdown (squash, remove branch, auto-merge). Disabled with reason when not mergeable.

### 4.4 Comments and replies
- `.../discussions/route.ts` POST: new discussion (MR-level or positional with `position` object).
- `.../discussions/[discussionId]/notes/route.ts` POST: reply to thread.
- `.../discussions/[discussionId]/resolve/route.ts` PUT: resolve/unresolve.
- Wire `ReplyInput.tsx`, `NewCommentInput.tsx`, `AddCommentButton.tsx` + `NewCommentForm.tsx` in diff view.
- Position construction for inline comments: `diff_refs` + file path + old_line/new_line from parsed hunk.

### 4.5 Refresh after actions
- After approve/unapprove: re-fetch approvals.
- After merge: re-fetch MR detail.
- After comment/reply/resolve: re-fetch discussions.
- SSE handles background updates; explicit refetch ensures immediate UI consistency after user actions.

**Deliverable:** Complete interactive review. All MR actions work.

---

## Phase 5: User Preferences + JIRA Links

**Goal:** Persistent preferences, JIRA ticket patterns as links.

### 5.1 Preferences
- `src/lib/types/preferences.ts`: shape with notification toggles, age thresholds, jiraBaseUrl.
- `use-preferences.ts`: reads/writes `shipyard_prefs` cookie (JSON).
- `Modal.tsx`: reusable modal with backdrop blur.
- `PreferencesModal.tsx`: notification toggles, age threshold inputs, optional JIRA base URL. Save writes cookie.
- `UserMenu.tsx`: dropdown with name/username, Preferences (opens modal), Sign Out.

### 5.2 Wire preferences
- `MRCard.tsx`: reads `orangeHours`/`redHours` for age tinting.
- Notifications/audio (Phase 3): already read preference toggles.

### 5.3 JIRA link detection
- `JiraLink.tsx`: if `jiraBaseUrl` set, render `PROJ-1234` as `<a href="{jiraBaseUrl}/browse/PROJ-1234">`. Otherwise plain text.
- Applied in MR description and note bodies.

**Deliverable:** Preferences persist across sessions. JIRA references are clickable external links.

---

## Phase 6: Polish + Edge Cases

**Goal:** Production-quality UX.

### 6.1 Loading states
- Skeleton loaders for MR list, overview, each tab content.
- Spinner on action buttons while in-flight.

### 6.2 Error handling
- Error boundaries per tab. Friendly messages + Retry.
- GitLab error handling: 401→re-auth, 403→permission denied, 429→rate limit message, 5xx→retry.
- SSE disconnect: "Reconnecting..." banner.

### 6.3 Merge options modal
- Merge button opens dropdown: squash, remove branch, auto-merge checkboxes, optional custom commit message, confirm button.

### 6.4 Keyboard navigation
- `j`/`k`: navigate MR list. `Enter`: select MR. `1-5`: switch tabs. `Esc`: close modals. Focus trapping in modals.

### 6.5 Large MR handling
- Auto-collapse all file sections when >20 files or >5,000 diff lines. "Large changeset" notice.
- `content-visibility: auto` on collapsed sections.

### 6.6 Link audit
- All usernames → GitLab profile. All SHAs → GitLab commit. MR IIDs in notifications → select MR in Shipyard.

**Deliverable:** Polished, robust app ready for daily use.

---

## Phase 7: JIRA Popup (API Integration)

**Goal:** In-page JIRA ticket popup with live data.

- Add JIRA email + API token inputs to PreferencesModal (stored in encrypted HttpOnly cookie).
- `jira-client.ts`: reads credentials from cookie, calls JIRA Cloud REST API v2.
- `src/app/api/jira/issue/[key]/route.ts` GET: `GET /rest/api/2/issue/{key}?fields=summary,status,priority,issuetype,assignee,reporter,description`. Proxied through server (CORS).
- `JiraPopup.tsx`: modal with ticket key, summary, field grid, description. Loading/error states.
- Update `JiraLink.tsx`: if JIRA credentials configured, click opens popup instead of external link.

**Deliverable:** JIRA references open rich in-page popups.

---

## Phase 8: Docker + Production Hardening

**Goal:** Deployable container, documentation.

### 8.1 Docker
- `Dockerfile`: multi-stage (node:20-alpine builder → standalone runner). Non-root user. Expose 3000.
- `docker-compose.yml`: env vars, port mapping, restart policy, health check.
- `.dockerignore`.

### 8.2 Production config
- `src/middleware.ts`: redirect unauthed to sign-in, security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy).
- `src/app/api/health/route.ts`: returns status, hydration state, connection count.

### 8.3 Final audit
- All console calls through logger. All fetches through rate limiter. SSE reconnection. Token refresh (2h expiry). No secrets in browser.

**Deliverable:** Docker image buildable and runnable in one command. Production-ready.

---

## Phase Dependencies

```
Phase 1 (Auth + MR List)
  → Phase 2 (Read-Only Detail + Tabs)
    → Phase 3 (Real-Time SSE + Notifications + Audio)
      → Phase 4 (Write Actions)
        → Phase 5 (Preferences + JIRA Links)
          → Phase 6 (Polish)
            → Phase 7 (JIRA API)
              → Phase 8 (Docker + Production)
```

Phases 4 and 5 could run in parallel (independent of each other). All others are sequential.

---

## Key Dependencies (npm)

| Package | Purpose |
|---------|---------|
| next@14 | Framework |
| react@18, react-dom@18 | UI |
| next-auth@5 | GitLab OAuth + JWT sessions |
| react-diff-view | Diff rendering with inline comment widgets |
| highlight.js | Syntax highlighting in diffs |
| ansi_up | ANSI→HTML for pipeline job logs |
| typescript, @types/react, @types/node | Type safety |

No database driver, no Redis, no external state store. Intentionally minimal dependency footprint.

---

## Verification

After each phase, verify by:
1. **Phase 1:** Sign in with GitLab. MR list populates for the configured group. Filter/sort work. Sign out works.
2. **Phase 2:** Select an MR. All five tabs render with real data. Diffs show syntax highlighting. Inline comments visible. Pipeline logs render. History timeline populates.
3. **Phase 3:** Leave dashboard open. Create/update an MR in GitLab. Within 30s, dashboard reflects the change. Toast appears. Chime plays (after any click on the page).
4. **Phase 4:** Approve an MR. Post a comment. Reply to a thread. Resolve a thread. Add an inline diff comment. Merge a mergeable MR. Verify all actions reflected in GitLab.
5. **Phase 5:** Open Preferences. Change age thresholds. Verify card tinting updates. Set JIRA URL. Verify ticket references become links. Reload page — preferences persist.
6. **Phase 6:** Slow network simulation — verify loading states. Kill server — verify SSE reconnect banner. Navigate with keyboard only.
7. **Phase 7:** Configure JIRA credentials. Click a ticket reference. Popup shows live data from JIRA.
8. **Phase 8:** `docker build -t shipyard . && docker run -p 3000:3000 --env-file .env shipyard`. Verify full app works from container. Health endpoint responds.
