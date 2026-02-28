# Shipyard — Research Notebook

This document tracks open research questions, findings, and decisions needed before building a project plan.

---

## 1. GitLab API Surface

**Question:** What REST/GraphQL endpoints cover the full set of MR data, actions, inline diffs, pipeline logs, and user profiles needed by Shipyard?

**Findings:**

### MR Listing (Group-Level)
- **`GET /api/v4/groups/:id/merge_requests`** with `state=opened&scope=all&include_subgroups=true`.
- **Critical:** `scope` defaults to `created_by_me` — always pass `scope=all`. `include_subgroups=true` is mandatory.
- Returns summarized MR objects (most fields but not full diffs or detailed approval rules).
- Supports pagination (offset or keyset), up to 100 per page.
- **GraphQL alternative:** `group(fullPath:).mergeRequests(state: opened, includeSubgroups: true)` — recommended for the list view (fetch exactly the fields needed).

### MR Detail Fields
- **`GET /api/v4/projects/:id/merge_requests/:iid`** returns the full MR object.
- Key fields: `title`, `description`, `state`, `draft`, `has_conflicts`, `source_branch`, `target_branch`, `author`, `assignees`, `reviewers`, `labels`, `milestone`, `pipeline` (head pipeline summary), `diff_refs` (critical for inline comments), `web_url`, `changes_count`, `user_notes_count`, `created_at`, `updated_at`.
- **`detailed_merge_status`** — the single most important field for merge readiness. Values: `mergeable`, `checking`, `ci_must_pass`, `ci_still_running`, `conflict`, `discussions_not_resolved`, `draft_status`, `need_rebase`, `not_approved`, `requested_changes`, `blocked_status`, `external_status_checks`, etc.
- Use `with_merge_status_recheck=true` on first call after changes to get fresh data (initial response may be stale).

### Approvals
- **Read:** `GET .../merge_requests/:iid/approvals` → `approved`, `approvals_required`, `approvals_left`, `approved_by` (list of users).
- **Approve:** `POST .../merge_requests/:iid/approve` (optionally pass `sha` for safety — rejects if HEAD changed).
- **Unapprove:** `POST .../merge_requests/:iid/unapprove`.

### Request Changes — GraphQL Only
- **No stable REST endpoint.** "Request Changes" is modeled through reviewer state (GitLab 16.0+).
- Use **GraphQL mutation `mergeRequestSetReviewState`** with `state: REQUESTED_CHANGES`. This sets `detailed_merge_status` to `requested_changes` and blocks merge.

### Merge
- **`PUT .../merge_requests/:iid/merge`** with options: `squash`, `should_remove_source_branch`, `merge_when_pipeline_succeeds` (auto-merge / merge train enqueue), `sha` (safety check), custom commit messages.
- Returns `405` if not mergeable, `409` if SHA mismatch.
- Cancel auto-merge: `POST .../cancel_merge_when_pipeline_succeeds`.
- Rebase: `PUT .../merge_requests/:iid/rebase` (async, check `rebase_in_progress`).

### Inline Diff Comments (Positional Notes)
- **Create:** `POST .../merge_requests/:iid/discussions` with `body` + `position` object.
- Position requires: `position_type: "text"`, `base_sha`, `start_sha`, `head_sha` (from `diff_refs`), `old_path`, `new_path`, `old_line` (null for additions), `new_line` (null for deletions).
- **Read:** `GET .../merge_requests/:iid/discussions` returns all discussions with notes, each note having `type` (`DiffNote` vs `DiscussionNote`), `position`, `resolved`, `author`, `body`.
- **Reply:** `POST .../discussions/:discussion_id/notes` with `body`.
- **Resolve:** `PUT .../discussions/:discussion_id` with `resolved: true`.

### Diffs
- **`GET .../merge_requests/:iid/changes`** returns all file diffs in one response. The `diff` field is **raw unified diff text** (not structured JSON).
- **`GET .../merge_requests/:iid/diffs`** returns paginated diff files (better for large MRs).
- No control over context lines (GitLab uses default 3).
- **Full diff content only via REST** — GraphQL provides `diffStats` but not actual diff text.

### Pipeline & Job Logs
- **Pipelines for MR:** `GET .../merge_requests/:iid/pipelines` or use `head_pipeline` field on MR detail.
- **Jobs in pipeline:** `GET .../pipelines/:pipeline_id/jobs` — each job has `stage`, `status`, `duration`, etc. Group by `stage` to reconstruct stages.
- **GraphQL alternative:** `pipeline.stages.nodes` with nested `jobs.nodes` — gives stages as first-class objects (cleaner for UI).
- **Job logs:** `GET .../jobs/:job_id/trace` returns plain text with ANSI escape codes.
- **No streaming endpoint.** Simulate streaming via **HTTP Range requests** (`Range: bytes=N-`), polling every 2-3s for running jobs. Response is `206 Partial Content` while running, `200 OK` when complete.
- **Gotcha:** Logs contain raw ANSI codes — need `ansi_up` or similar library for rendering.

### MR History / Timeline
- **No unified timeline endpoint.** Reconstruct from:
  - `GET .../merge_requests/:iid/notes?sort=asc` — includes **system notes** (`system: true`) which cover: approvals, state changes, pushes, draft status changes, merge, rebase, etc.
  - `GET .../merge_requests/:iid/resource_state_events` — state changes (opened/closed/merged).
  - Pipeline data from the pipelines endpoint.
- System notes are the richest source — they effectively provide a full event timeline.
- GraphQL `notes` include `systemNoteIconName` for categorizing events (useful for icons/colors).

### User Profiles
- User objects are **already embedded** in MR/note responses: `{ id, username, name, avatar_url, web_url }`.
- No separate calls needed in most cases.
- **Gotcha:** `avatar_url` may be relative on self-managed GitLab — resolve against instance base URL.

---

## 2. Real-Time Update Strategy

**Question:** How do we push live updates to the browser without page reloads — what's the server-side source of truth?

**Findings:**

### GitLab Has No Public Real-Time API
- GitLab uses Action Cable internally (WebSocket for its own UI), but this is **not a public API** — undocumented, unsupported, requires internal session cookies (not OAuth tokens).
- **GraphQL subscriptions are internal-only.** Tantalizing subscription types exist (`mergeRequestApprovalStateUpdated`, `pipelineStatusUpdated`, etc.) but are not part of the public API contract.
- Pipeline job logs endpoint (`GET /projects/:id/jobs/:job_id/trace`) returns plain text with no streaming — must poll with byte offset tracking to simulate streaming.

### Webhooks
- **Group-level webhooks require GitLab Premium tier.** Project-level webhooks are available on all tiers.
- Relevant events: `merge_request_events` (open, close, approve, merge, update), `pipeline_events` (status changes), `note_events` (comments/discussions).
- Webhook payloads include MR details, pipeline info, note content, and position data for inline comments.
- Webhooks carry a secret token in `X-Gitlab-Token` header for validation.
- **Limitation:** Webhooks require the server to be reachable from GitLab — problematic for localhost/NAT.

### API Rate Limits
- **GitLab.com:** 2,000 authenticated requests/minute per user. GraphQL uses complexity-based limits (~200 points/query, ~800 points/minute).
- **Self-managed:** No rate limits by default (admin-configurable).
- **Polling feasibility:** Using the group MR list endpoint (`GET /groups/:id/merge_requests?state=opened`), one request returns all open MRs. At 30s intervals = ~2 requests/min. With targeted detail polling for the active MR, total is ~20-40 requests/min — well within limits.

### Recommended Architecture: Polling Only + SSE
- **No webhooks.** Design decision: Shipyard should be usable by anyone with GitLab access, regardless of their permission level or GitLab tier. Webhooks require configuration access and Premium for group-level. Polling removes that dependency entirely.
- **Server polls GitLab, pushes to browser via SSE.**
  - Every 15-30s: poll MR list endpoint for the group.
  - Every 10-15s: poll details of the currently-viewed MR.
  - Accept 10-15s latency for updates — acceptable tradeoff for universal accessibility.
- **Built-in rate limiter:** The server must self-limit its own GitLab API calls per-endpoint according to GitLab's published limits (2,000 req/min authenticated on gitlab.com). Track usage with a token-bucket or sliding-window counter. Never rely on hitting GitLab's rate limiter — stay under it proactively.
- **Browser push: SSE (Server-Sent Events).** Simpler than WebSocket, sufficient for server-to-client push. Browser's `EventSource` API handles reconnection automatically.

### Deployment Constraint
- SSE requires a **persistent Node.js process** (VPS, Docker container, etc.).
- **Not compatible with serverless** (Vercel Lambda) due to execution time limits and ephemeral state.
- Document this as a requirement: `next start` or container-based deployment.

---

## 3. GitLab OAuth & Session Management

**Question:** How do we authenticate users via GitLab OAuth and maintain sessions with no durable storage?

**Findings:**

### OAuth Flow
- Use **Authorization Code grant** (confidential app). GitLab supports this, PKCE, Implicit (deprecated), and ROPC (deprecated).
- Endpoints: `/oauth/authorize` (authorize), `/oauth/token` (token exchange/refresh).
- PKCE is supported (GitLab 15.x+) and optional for server-side apps — nice-to-have but not required.

### Scopes
- GitLab's scope model is **coarse**. There is no `write_merge_requests` or `write_notes` scope.
- Since Shipyard needs to write comments, approve, and merge — we **must request the `api` scope** (full read/write).
- `read_api` would suffice for a read-only mode.
- Optionally add `openid profile email` if using OIDC for identity.

### Token Lifecycle
- Access tokens expire after **2 hours** (default, configurable on self-managed).
- **Refresh tokens are issued** alongside access tokens. They are **single-use with rotation** — each refresh returns a new access_token AND a new refresh_token; the old refresh token is revoked.
- Refresh tokens do not have a hard expiration.
- **Gotcha:** Refresh token rotation means concurrent refresh attempts will fail. Token refresh logic must be serialized (mutex/lock pattern).

### Token Size & Cookie Feasibility
- Tokens are opaque strings, ~64 chars each (not JWTs).
- access_token + refresh_token + metadata ≈ **~180 bytes** raw. After AES-256-GCM encryption + base64 ≈ **~300-350 bytes**.
- **Easily fits in a single cookie** (4KB limit). Enormous headroom even with user profile data added.

### Session Strategy (No Database)
- **Option A: Auth.js v5** — Has a built-in GitLab provider. Supports `jwt` session strategy (encrypted cookie, no DB needed). Requires custom `jwt` callback for token refresh. Well-maintained, works with App Router.
- **Option B: `iron-session`** — Stateless encrypted cookie sessions. Use with manual OAuth code exchange. More control, less abstraction.
- Both achieve the same result: encrypted HTTP-only cookie with no server-side session store.

### Application Registration
- Register at **User-level** (User Settings → Applications) or **Group-level** (Group Settings → Applications).
- Must set **Confidential = Yes** for server-side apps.
- Redirect URI must be **exact match** — separate entries needed for localhost (dev) and production.
- Scopes selected at registration time are a ceiling — app cannot request more at auth time.

### Recommendation
- Auth.js v5 with JWT strategy is a good fit. Built-in GitLab provider handles the OAuth dance; JWT session mode gives us cookie-only storage.
- Main custom work: `jwt` callback for token refresh with rotation handling.
- If Auth.js proves too opinionated, straightforward to swap to `iron-session` + manual OAuth (the underlying flow is simple with one provider).

---

## 4. JIRA Integration

**Question:** How does the JIRA ticket popup authenticate and fetch ticket details?

**Findings:**

### Cloud vs. Server/DC API
- Both support `GET /rest/api/2/issue/{issueIdOrKey}` — use v2 for maximum compatibility.
- Key differences: Cloud v3 returns descriptions as ADF (JSON AST), v2 returns HTML/text. User objects differ (Cloud uses `accountId`, Server uses `name`/`key`). Sprint field ID varies per instance.
- Stick to `/rest/api/2/` for both platforms.

### Authentication
- **Cloud:** Email + API token via Basic auth is simplest. User generates token at Atlassian account settings.
- **Server/DC:** Personal Access Tokens (PAT) via Bearer auth is simplest. Available on DC 7.14+ / Server 8.14+.
- Full OAuth is available but overkill for a personal/small-team tool.

### Credential Storage
- Store JIRA base URL + encrypted API token/PAT in an **encrypted HttpOnly cookie**, same pattern as GitLab tokens.
- Adds ~200-400 bytes to cookie payload — still well within 4KB limit.
- User enters JIRA credentials in Preferences UI; stored in cookie on save.

### Fetching Ticket Details — Single API Call
- `GET /rest/api/2/issue/PROJ-1234?fields=summary,status,priority,issuetype,assignee,reporter,description` returns all popup fields in one call.
- For sprint data: use `GET /rest/agile/1.0/issue/PROJ-1234?fields=...,sprint` (avoids custom field ID discovery), or discover the sprint custom field ID via `GET /rest/api/2/field` on first connection.

### CORS — Must Proxy
- **JIRA Cloud does not set CORS headers** for external origins. Browser-direct calls are blocked.
- **Must proxy through the Next.js server** — browser calls `/api/jira/issue/PROJ-1234`, server calls JIRA with credentials from cookie. This also keeps the JIRA token out of the browser.

### Rate Limits — Non-Issue
- Cloud: ~100 requests/10 seconds per user. Each popup is one call; not a concern.
- Server/DC: No formal API rate limits by default.

### Recommendation: Defer to Phase 2
- JIRA popup is a read-only convenience feature; does not affect core MR workflow.
- **Phase 1:** Detect `PROJ-1234` patterns, render as links to JIRA web UI (`https://yoursite/browse/PROJ-1234`). Zero API work.
- **Phase 2:** Add Preferences UI for JIRA credentials, server proxy route, in-page popup with fetched ticket details.

---

## 5. Ephemeral State & Notification Architecture

**Question:** How much server-side in-memory state is acceptable, and how do we detect MR state transitions for notifications?

**Findings:**

### In-Memory State Pattern
- Use a **module-singleton `Map`** (plain JS `Map` at module scope). Node's module caching ensures a single instance per process.
- No need for LRU cache — the MR set is bounded by GitLab's API response (~50-100 MRs). Memory usage: ~500KB for 100 MRs. Negligible.
- **Single-process assumption is explicit.** No horizontal scaling. This is fine for a personal/small-team tool.

### State Transition Detection ("Polling Diff" Pattern)
- Poll GitLab every 20-30s, compare new MR data against the in-memory `Map`.
- If `detailed_merge_status` transitioned from non-`mergeable` to `mergeable`, fire a "ready to merge" notification.
- **Gotcha:** GitLab has a transient `checking` state after pushes. Only fire notifications on stable terminal states (`mergeable`), not on exit from a blocking state.
- **First poll edge case:** On startup, every MR is "new". Populate the `Map` silently on the first poll — do not emit transition events. Use a `isHydrated` flag.

### Server Restart / Warm-Up
- State is lost on restart — acceptable. Server does a full fetch to rebuild the `Map`.
- During the warm-up window (first poll, typically <2s), no transition notifications fire.
- Optionally expose a `status` SSE event (`hydrating` → `ready`) so the client can show a subtle "syncing..." indicator.

### SSE in Next.js App Router
- App Router Route Handlers support SSE via `ReadableStream` with `Content-Type: text/event-stream`.
- **Requires persistent Node.js process** (`next start`, Docker container, etc.). Not compatible with serverless (Vercel Lambda — execution time limits kill the connection).
- The broadcaster pattern: polling module maintains the `Map` + a `Set` of active SSE stream controllers. On transition, iterate the `Set` and write events. On client disconnect, remove from `Set`.
- Browser's `EventSource` API handles reconnection automatically.

### Notification Persistence
- **Use a cookie** for unread state — a `notificationsReadAt` timestamp (13 bytes). Any notification before that timestamp is "read". This is server-readable for SSR (no hydration flash).
- Alternatively, a capped list of read notification IDs (last 30) — still well under 4KB.
- `localStorage` would work for client-only state but isn't available during SSR. Cookie is better for initial render correctness.

---

## 6. Diff Rendering

**Question:** How should we parse and render real unified diffs with line-level comment anchoring?

**Findings:**

### GitLab Diff Format
- REST `GET /projects/:id/merge_requests/:iid/changes` returns a `changes` array. Each entry has file metadata + a `diff` field containing **raw unified diff text** (standard `@@` hunk headers, `+`/`-`/` ` lines).
- NOT structured JSON with individual lines — you get one string per file that must be parsed.
- **Full diff content is only available via REST, not GraphQL.** GraphQL provides `diffStats` and `diffRefs` but not actual diff text.
- Paginated alternative: `GET .../diffs` returns diff files with pagination (better for large MRs).

### Library Recommendation: `react-diff-view`
- **Best fit for Shipyard.** React-native components (no `dangerouslySetInnerHTML`). First-class **widget system** for injecting comment threads between diff lines — exactly what inline comments need.
- Built-in `parseDiff()` produces structured hunks. `<Diff>` + `<Hunk>` components handle unified line layout, line numbers, change type styling.
- Gutter customization supports the hover "+" button for adding comments.
- ~900 GitHub stars. API is stable and mature. ~2,500 lines of well-structured code — forkable if abandoned.

### Why Not the Alternatives
- **`diff2html`**: Excellent parser, but its renderer outputs HTML strings, not React components. No inline comment injection. Using it as parser-only discards most of its value. Its parser can be a fallback for edge cases.
- **Fully custom renderer**: Would reimplement change key generation, unified/split layout, gutter rendering, and widget insertion — weeks of work `react-diff-view` already handles.

### Proposed Architecture
```
FileTree (custom, 220px panel, scroll-spy via IntersectionObserver)
DiffContainer (custom, scrollable)
  └─ Per file:
       FileHeader (custom, position: sticky, collapse toggle)
       CollapsibleSection
         └─ <Diff> from react-diff-view
              ├─ viewType="unified"
              ├─ hunks={parsedHunks}
              ├─ widgets={commentWidgets}  ← mapped from GitLab discussion positions
              └─ <Hunk> components
CommentThread (custom, rendered as widget)
```

### Inline Comment Position Mapping
- GitLab anchors notes with a position: `{base_sha, start_sha, head_sha, old_path, new_path, old_line, new_line}`.
- To map to rendered lines: match `new_path` to file, then match `old_line`/`new_line` to a change in the parsed hunks, generate a `changeKey`, and insert the comment widget at that key.
- For creating new comments: capture which line the user clicked, extract line numbers + file path, combine with `diff_refs` SHAs from the MR.

### Performance Strategy (No Full Virtualization)
- **Collapse-first for large MRs**: Collapse all file sections by default when >20 files or >5,000 diff lines. Expand on demand.
- **`content-visibility: auto`** CSS on file sections — browser skips layout/paint for off-screen sections. Supported in Chrome/Edge.
- **Defer full virtualization** — it conflicts with sticky headers, dynamic widget heights, and browser Ctrl+F. The collapse-first approach is what GitLab and GitHub themselves use.

### Syntax Highlighting
- Use **highlight.js** with per-line highlighting, integrated via `react-diff-view`'s `tokenize()` utility.
- Map file extension → language for explicit hinting.
- Tree-shake highlight.js imports to ~30-50KB for a reasonable language set.
- Upgrade to full-file tokenization later if quality is insufficient.

---

## 7. Browser Audio for Notifications

**Question:** How do we reliably play notification chimes in the browser?

**Findings:**

### Autoplay Policy
- All modern browsers (Chrome, Firefox, Safari) **block audio until a user gesture** (click, keydown, touchstart).
- Once the user has interacted and the `AudioContext` is `.resume()`d, it **stays unlocked for the session** on desktop.
- **Safari/iOS caveat:** AudioContext may be suspended when tab backgrounds; check `audioContext.state` before each play and `.resume()` if needed.

### Recommended Approach: Web Audio API (No Libraries, No Audio Files)
- Use **`OscillatorNode` + `GainNode`** to generate chimes programmatically. Fully supported in all modern browsers since 2014.
- Single tone: one oscillator at ~880 Hz (A5), `sine` waveform, ~200-400ms with a gain ramp-down to avoid click/pop.
- Double tone: two sequential tones (880 Hz → 1100 Hz), ~150ms each.
- Distinct ready-to-merge tone: different frequency/waveform (e.g., `triangle` at 660 Hz).
- **Zero file dependencies, zero bundle cost.**

### Pattern
1. Create `AudioContext` lazily on first user interaction (one-time `document` click/keydown listener).
2. Reuse the same `AudioContext` for the entire session (expensive OS-level resource).
3. Per chime: create fresh `OscillatorNode` → `GainNode` → `destination`, schedule start/stop, let GC clean up.
4. Before each play, check `audioContext.state === 'running'`; resume if suspended.

### Background Tabs
- **Desktop (Chrome, Firefox, Safari macOS):** Audio plays normally in background tabs. The Web Audio scheduler runs on its own thread, not subject to JS timer throttling.
- **iOS:** Unreliable in background tabs. Accepted limitation — not something a web app can solve.

### Libraries — Not Needed
- **Howler.js** (~18KB): Handles codec fallback and AudioContext lifecycle. Useful but overkill for synthesized tones.
- **Tone.js** (~400KB+): Music/synthesizer framework. Extremely overkill. Do not use.
- Raw Web Audio API is sufficient and correct for this use case.

---

---

## Key Decisions & Open Items

### Decided
- **OAuth:** Auth.js v5 with JWT strategy + GitLab provider. `api` scope (required for write operations).
- **Session:** Encrypted HTTP-only cookie. Tokens ~300 bytes after encryption — fits easily.
- **Real-time:** Polling only (no webhooks — keeps Shipyard usable without GitLab config access or Premium tier). SSE to browser. Server self-rate-limits against GitLab's published API limits.
- **Deployment:** Must be persistent Node.js process (not serverless). `next start` or container.
- **Diff rendering:** `react-diff-view` for line layout + widget system. Custom file tree, sticky headers, collapsible sections.
- **Audio:** Raw Web Audio API with `OscillatorNode`. No libraries, no audio files.
- **JIRA:** Defer to Phase 2. Phase 1 renders ticket references as links to JIRA web UI.
- **Ephemeral state:** Module-singleton `Map`. Single-process assumption. Silent first-poll hydration.
- **Notification persistence:** Cookie-based (`notificationsReadAt` timestamp).

### Resolved — User Input (2026-02-28)
- **GitLab instance:** gitlab.com (SaaS). Avatar URLs are absolute. 2,000 req/min rate limit applies.
- **GitLab tier:** Premium. However, webhooks are intentionally excluded from the design — Shipyard should not require any GitLab configuration or specific tier to use.
- **Deployment:** Docker container. Persistent process — SSE and in-memory state will work correctly.
- **JIRA instance:** JIRA Cloud (yoursite.atlassian.net). Auth via email + API token. (Phase 2.)

## Research Log

| Date | Area | Summary |
|------|------|---------|
| 2026-02-28 | GitLab API | Full endpoint mapping for MR list, detail, approvals, merge, diffs, pipelines, discussions, history. Request Changes requires GraphQL. No streaming for job logs — use Range polling. |
| 2026-02-28 | Real-time | No public WebSocket/SSE from GitLab. Hybrid polling + optional webhooks recommended. Group webhooks require Premium. SSE from server to browser. |
| 2026-02-28 | OAuth | Authorization Code flow, `api` scope, 2h token lifetime with refresh rotation. Auth.js v5 or iron-session for cookie-based sessions. |
| 2026-02-28 | JIRA | Single API call for ticket details. Must proxy through server (CORS blocked). Defer to Phase 2. |
| 2026-02-28 | Ephemeral state | Module-singleton Map, polling diff pattern, silent first-poll hydration. SSE via App Router ReadableStream. |
| 2026-02-28 | Diff rendering | react-diff-view for line layout + inline comment widgets. highlight.js for syntax highlighting. Collapse-first strategy for large diffs. |
| 2026-02-28 | Audio | Web Audio API OscillatorNode for programmatic chimes. No libraries needed. Unlock on first user gesture. |
