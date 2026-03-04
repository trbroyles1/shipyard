# Shipyard

A dark-mode, single-pane-of-glass dashboard for managing GitLab merge request reviews. Built to replace the tab-juggling workflow of navigating between projects and MRs in GitLab's native UI.

Shipyard monitors all open merge requests across a GitLab group, pushes real-time updates to the browser via SSE, and lets you review diffs, discuss, approve, and merge without needing to deal with page reloads or navigate between different subgroups and projects..

## Why

I courteously dislike GitLab's MR workflow, which involves a lot of clicking between projects and MRs, each time requiring a full page reload in the browser. For managing reviews across multiple projects in a group, it gets tedious fast. Shipyard is my stab at putting everything in one place as a single persistent view where MRs stream in, details load and reload inline, and you never leave the page.

## Features

- **Real-time MR list** — server polls GitLab and pushes new/updated/removed MRs via SSE
- **Unified diff viewer** — with inline discussion threads and multi-line commenting
- **Discussion threads** — view, reply to, and resolve MR discussions (both file-level and general)
- **Pipeline monitoring** — drill into pipeline stages and job logs with full ANSI color rendering
- **Approvals & merging** — approve, unapprove, and merge MRs right from the dashboard
- **Commit history** — browse commits with links back to GitLab
- **Event timeline** — audit trail of MR lifecycle events
- **Notifications** — toast + audio alerts for new MRs, reviewer assignments, and merge-readiness
- **JIRA link detection** — ticket references in MR titles/descriptions become clickable links
- **Themeable** — five themes (four dark, one light) with a CSS custom property architecture that makes adding more straightforward
- **User preferences** — theme, notification toggles, warning thresholds, JIRA base URL — all stored in a cookie
- **Single-tab enforcement** — only one active session per user; older tabs are gracefully displaced
- **No database** — all server state is ephemeral in-memory; preferences live in cookies
- **Security hardened** — CSP headers, DOMPurify, httpOnly JWT cookies, input validation

## How It Was Built

Mostly with Claude. I'm a back end developer by trade; Go / Python (and to a lesser extend, Rust) are my normal workspace. But those are none of them really great for a front end facing app (Python somewhat better than the others). Node & Next seem to be where it's at for that kind of work, so that's what I decided to use for this. But, since I don't yet know that stack very well, it's our dear AI friends Claude and Codex to the rescue. 

## Design Choices

**Zero page reloads.** My primary motivation for the project was the friction of navigating between MRs in GitLab, so keeping the app in sync with GitLab without ever requiring a page refresh was my primary concern. The server polls GitLab and pushes updates to the browser over SSE; the client renders everything in a single persistent shell.

**Polling over webhooks.** Shipyard polls the GitLab API rather than requiring webhook configuration. This was deliberate for a few reasons: 1) I did not want to saddle anyone else who might want to make use of the app with the need to configure webhooks in their gitlab instance to use it, especially since 2) Group webhooks (which would be needed if you didn't want to have to set them up project by project) are only available at Premium/Ultimate tiers and 3) in order to set up a webhook, you need a publicly accessible URL which is not readily available if you run the app purely locally. Finally, 4) folks might not be comfortable with a durable webhook that continuously ships MR data to an external endpoint.

Polling keeps deployment (mostly) self-contained.

**No durable state.** The app maintains no persistent storage between restarts. No database, no file-based state, no long-term tracking of MR history. This was intentional from the beginning: Shipyard is a frontend for the data in GitLab, not a separate repository of it. User preferences are the sole exception, and those live in a cookie.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| UI | React 18, CSS Modules + custom properties |
| Auth | Auth.js v5 (GitLab OAuth, JWT strategy) |
| Real-time | Server-Sent Events |
| Diff rendering | react-diff-view + unidiff |
| Markdown | react-markdown, remark-gfm, rehype-highlight |
| Diagrams | Mermaid |
| Syntax highlighting | highlight.js |
| CI log rendering | ansi_up |

No Tailwind, database or external webhooks (beyond those required for OAuth)

## Prerequisites

- Node.js 24+
- A GitLab instance (gitlab.com or self-hosted)
- A GitLab OAuth application (see [Setup](#setup))

## Setup

### 1. Create a GitLab OAuth application

In your GitLab instance, go to **User Settings > Applications** (or ask a group admin to create one under **Group Settings > Applications**) and create an application with:

- **Redirect URI**: `http://localhost:3000/api/auth/callback/gitlab` (adjust host/port for your setup scenario)
- **Scopes**: `api`, `read_user`

Note the **Application ID** and **Secret**.

### 2. Find your GitLab group ID

Navigate to your top-level GitLab group page. The numeric group ID is shown under the group name, or you can find it via the GitLab API.

### 3. Configure environment

```bash
cp .env.example .env.local
```

Fill in the values:

```bash
# Required
AUTH_SECRET=          # generate with: openssl rand -base64 32
AUTH_GITLAB_ID=       # OAuth Application ID from step 1
AUTH_GITLAB_SECRET=   # OAuth Secret from step 1
GITLAB_GROUP_ID=      # numeric group ID from step 2

# Optional
GITLAB_URL=https://gitlab.com   # your GitLab instance URL
LOG_LEVEL=INFO                  # DEBUG | INFO | WARN | ERROR
MR_POLL_INTERVAL=25             # seconds between polls for the viewed MR
```

### 4. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with GitLab.

### Production

```bash
npm run build
npm start
```

The Next.js config uses `output: "standalone"`, so the build output in `.next/standalone` is self-contained and suitable for containerized deployments.

### Docker

Pull the latest image from GitHub Container Registry:

```bash
docker pull ghcr.io/trbroyles1/shipyard:latest
```

Run with an env file:

```bash
docker run -d \
  --name shipyard \
  -p 3000:3000 \
  --env-file .env.local \
  ghcr.io/trbroyles1/shipyard:latest
```

Or pass environment variables directly:

```bash
docker run -d \
  --name shipyard \
  -p 3000:3000 \
  -e AUTH_URL=http://localhost:3000 \
  -e AUTH_SECRET="$(openssl rand -base64 32)" \
  -e AUTH_GITLAB_ID=your_application_id \
  -e AUTH_GITLAB_SECRET=your_application_secret \
  -e GITLAB_GROUP_ID=your_group_id \
  ghcr.io/trbroyles1/shipyard:latest
```

`AUTH_URL` must be set to the URL users will access Shipyard at (e.g. `http://localhost:3000` for local use, or `https://shipyard.example.com` behind a reverse proxy). Auth.js uses this to construct OAuth callback URLs. When running outside Docker (`npm run dev` / `npm start`), this is auto-detected and not required.

Optional environment variables:

| Variable | Default | Description |
|---|---|---|
| `GITLAB_URL` | `https://gitlab.com` | GitLab instance URL |
| `LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARN`, or `ERROR` |
| `MR_POLL_INTERVAL` | `25` | Seconds between GitLab polls for the viewed MR |
| `PORT` | `3000` | Port the server listens on |

## Theming

Shipyard ships with five themes — four dark, one light:

| Theme | Mode | Character |
|---|---|---|
| Classic | Dark | Cyan accents on cool slate, clean and minimal |
| Brinjal | Dark | Lime green on deep plum with frosted glass effects |
| Drydock | Dark | Brass and amber with a warm industrial aesthetic |
| Bermude | Light | Ocean teal and coral on warm sand |
| Myrtille | Dark | Cyan-blue on deep navy with glass effects and 3D buttons |

Switch themes from the preferences panel in the app. To create a new theme, see [`project_docs/THEMING.md`](project_docs/THEMING.md).

## Architecture Notes

- **Server-side polling**: the server polls GitLab on a configurable interval and pushes changes to the browser over SSE. The client never calls GitLab directly.
- **Rate limiting**: a token-bucket rate limiter governs outbound GitLab API calls; inbound API routes have per-IP rate limits.
- **Single process**: all server state (MR store, active sessions, viewed-MR tracking) lives in memory on a single Node process. This keeps things simple but means horizontal scaling would require sticky sessions.
- **Token refresh**: GitLab OAuth tokens are automatically refreshed with mutex protection and exponential backoff on transient failures.
- **Graceful degradation**: SSE connections report health status (hydrating → ready → degraded) so the UI can inform users when polling is failing.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with HMR |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run check:themes` | Validate theme CSS files |

## Known Limitations


- **"Request Changes"** is not yet implemented - it requires a GitLab GraphQL mutation that is on the backlog.
- **Single process** - not horizontally scalable without sticky sessions / shared state (not currently planned).
- **No Markdown preview when writing comments** - not something I've needed yet. Once posted it will render as Markdown, but writing it will show plain text for now.

## License

[MIT](LICENSE)
