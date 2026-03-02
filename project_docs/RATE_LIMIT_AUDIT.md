# GitLab API Rate Limit Audit

**Date:** 2026-03-02
**Scope:** All GitLab REST API v4 endpoints called by the Shipyard server, assessed against published GitLab rate limits for GitLab.com and self-managed instances.

---

## 1. Summary of Findings

### Vulnerabilities (risk of exceeding limits)

| # | Issue | Severity | Scenario |
|---|-------|----------|----------|
| V1 | **Multiple-tab poller duplication** | Medium | Each browser tab opens a separate SSE connection, spawning an independent poller. There is no deduplication — a user with 5 tabs generates 5× the polling load under a single GitLab user token. |
| V2 | **Global rate limiter masks per-user overload** | Low | The token bucket is a process-wide singleton (2000 req/min across all users). It cannot detect or prevent a single user from burning through their individual GitLab quota if they dominate the bucket. |
| V3 | **Job trace route bypasses retry logic** | Low | The job trace endpoint (`trace/route.ts`) uses raw `fetch()` instead of `fetchWithRetry()`. On transient errors it returns the error directly with no retries, increasing the chance of user-triggered retries that stack up. |
| V4 | **No awareness of endpoint-specific sub-limits** | Low | GitLab enforces per-endpoint limits (e.g., 60 notes/min for comment creation) that are stricter than the umbrella 2000/min. The rate limiter treats all endpoints equally and cannot prevent hitting these lower ceilings. |

### Headroom Being Left on the Table

| # | Finding | Impact |
|---|---------|--------|
| H1 | **Global bucket is correctly sized for GitLab.com but overly restrictive for self-managed** | GitLab.com enforces a **per-IP** limit of 2,000 req/min that caps all traffic from the Shipyard server regardless of which user token is used. The global bucket correctly mirrors this. However, self-managed instances typically have rate limits disabled by default, making the 2,000/min cap unnecessarily restrictive for those deployments. |
| H2 | **25s polling interval is conservative** | At ~12 API calls/min per user, a single user uses < 1% of their 2000/min GitLab quota for polling alone. The interval could be reduced for faster update detection without risk — but the per-IP limit means the headroom must be shared across all users. |

---

## 2. GitLab Published Rate Limits

### 2.1 GitLab.com (SaaS) — Umbrella Limits

| Category | Limit | Period |
|----------|-------|--------|
| Authenticated API (per user) | 2,000 requests | 1 minute |
| Authenticated non-API HTTP (per user) | 1,000 requests | 1 minute |
| Unauthenticated (per IP) | 500 requests | 1 minute |
| **All traffic from a single IP** | **2,000 requests** | **1 minute** |

> **Critical for server deployments:** The per-IP limit of 2,000 req/min applies to the **aggregate** of all requests from the Shipyard server's IP address, regardless of which authenticated user they are for. This means multiple authenticated users sharing the Shipyard server do NOT get separate 2,000/min pools at the IP level — they share a single 2,000/min budget from the server's IP. Each user is also independently capped at 2,000/min per their token, but the IP-level limit is the **binding constraint** for multi-user server deployments on GitLab.com.
>
> The docs state: *"GitLab can rate-limit requests at several layers. The rate limits listed here are configured in the application. These limits are the most restrictive for each IP address."*

### 2.2 GitLab.com — Endpoint-Specific Sub-Limits

These apply **in addition to** the umbrella limit:

| Endpoint / Action | Limit | Relevance to Shipyard |
|---|---|---|
| `GET /groups` (list) | 200/min | Not used directly |
| `GET /groups/:id` (single) | 400/min | The MR list endpoint is a sub-resource; may be governed by this |
| `GET /groups/:id/projects` | 600/min | Not used |
| `GET /projects/:id` | 400/min | Not used directly |
| Note/comment creation (MR or issue) | 60/min | Applies to POST discussions, POST notes |
| `GET /projects/:id/jobs` | 600/min | Applies to pipeline job listing |
| Job trace (`/jobs/trace`) | 200/min | Applies to job log streaming |
| Commit diff files | 6/min per user/IP | Likely applies to the `commits/:sha/diff` endpoint specifically, not MR changes — but worth monitoring |

### 2.3 Self-Managed GitLab — Default Limits

| Category | Default | Notes |
|----------|---------|-------|
| Authenticated API (per user) | 7,200/hour (2/sec) | **Disabled by default.** Admin must enable in Settings > Network. |
| Endpoint-specific (Groups, Projects, Users APIs) | Disabled (0) | Requires manual configuration by admin. |

### 2.4 Rate Limit Response Headers

GitLab returns these on all API responses:

| Header | Description |
|--------|-------------|
| `RateLimit-Limit` | Quota per minute |
| `RateLimit-Remaining` | Remaining quota |
| `RateLimit-Reset` | Unix timestamp of reset |
| `RateLimit-Observed` | Requests made in window |
| `Retry-After` | Seconds until reset (429 only) |

**Caveat:** These headers only reflect the main `throttle_authenticated_api` limiter, not endpoint-specific sub-limits. There is a known GitLab issue where Cloudflare may strip these headers on GitLab.com.

---

## 3. Shipyard's Self-Rate-Limiting Mechanisms

### 3.1 Token Bucket (`src/lib/rate-limiter.ts`)

| Parameter | Value |
|-----------|-------|
| Capacity | 2,000 tokens |
| Refill rate | 2,000 tokens per 60 seconds (linear) |
| Scope | **Global** (process-wide singleton, all users, all endpoints) |
| Behavior when empty | Blocks caller until 1 token available |
| Warning threshold | 80% utilization |

### 3.2 Retry with Backoff (`src/lib/gitlab-client.ts`)

| Parameter | Value |
|-----------|-------|
| Max retries | 2 (3 total attempts) |
| Initial backoff | 1,000 ms |
| Max backoff | 10,000 ms |
| Backoff strategy | Exponential with jitter (0.5–1.0× multiplier) |
| 429 handling | Honors `Retry-After` header without cap |
| Transient errors | 408, 429, 500, 502, 503, 504, network errors |
| Non-retried | 401 (auth errors) |

### 3.3 Polling Intervals (`src/lib/mr-poller.ts`)

| Parameter | Value |
|-----------|-------|
| Poll interval | 25,000 ms (25 seconds) |
| Degraded threshold | 3 consecutive errors |
| Token expiry buffer | 5 minutes before expiry |

### 3.4 What Happens Per Poll Cycle (Per User)

| Call | Endpoint | Condition | Requests |
|------|----------|-----------|----------|
| MR list | `GET /groups/:id/merge_requests` | Always | 1 per page (ceil(openMRs/100)) |
| MR detail | `GET /projects/:id/merge_requests/:iid` | If viewing MR | 1 |
| Approvals | `GET /projects/:id/merge_requests/:iid/approvals` | If viewing MR | 1 |

**Typical per-user per-minute:** 2.4 × (pages + 0 or 2) = **2.4–12 requests/min** depending on MR count and whether viewing an MR.

---

## 4. Detailed Vulnerability Analysis

### V1: Multiple-Tab Poller Duplication

**Mechanism:** Each call to `GET /api/sse` creates a new `startPoller()` instance with its own 25-second loop. The viewed-MR store is keyed by userId (a single entry per user), so the approval-polling part is harmless (all tabs poll the same viewed MR). However, the MR list poll runs independently per tab — each tab does a full `gitlabFetchAllPages` of the group MRs.

**Impact math (GitLab.com):**
- 1 tab: ~2.4 calls/min for MR list (assuming 1 page)
- 5 tabs: ~12 calls/min for MR list (5× duplication)
- 5 tabs + 200 open MRs (2 pages each): ~24 calls/min

This is still well within the 2000/min umbrella. The risk is more about wasted quota than about hitting limits, unless a user has many tabs open and there are many open MRs (high page counts).

**Risk level:** Medium (wasteful rather than dangerous, but could combine with other load to approach limits in edge cases).

### V2: Global Rate Limiter Masks Per-User Overload

**Mechanism:** The rate limiter is a single process-wide token bucket. GitLab rate limits are per-user (per OAuth token). The bucket does not partition by user.

**Scenario where this matters:**
- 20 users connected. Global budget = 2000/min (Shipyard) vs 20 × 2000 = 40,000/min (GitLab).
- User A opens the app and triggers a burst of on-demand requests (detail, discussions, notes, pipelines, commits, changes). This burst might be 10–20 requests in rapid succession.
- Meanwhile, 19 other pollers are running. Total polling load ≈ 19 × 2.4 = ~46/min.
- No risk of any individual user exceeding their own GitLab limit.

**Reverse scenario:** If only 1 user is connected and somehow generates 2000 requests in a minute (impossible in normal usage but theoretically possible with aggressive tab-opening + on-demand requests), the rate limiter would pass them all through, and the single user would hit their GitLab per-user limit.

**Risk level:** Low — normal usage patterns make this nearly impossible.

### V3: Job Trace Bypasses Retry Logic

**Mechanism:** `trace/route.ts` calls `acquire()` for the rate limiter but uses raw `fetch()` instead of `fetchWithRetry()`. If the fetch fails transiently (502, timeout), the error propagates directly to the client. The client may retry, generating duplicate requests.

Additionally, each job trace request makes **2 API calls** (trace + job status), each acquiring a separate rate limit token.

**Risk level:** Low — job log viewing is infrequent and user-initiated.

### V4: No Endpoint-Specific Sub-Limit Awareness

**Mechanism:** The rate limiter applies a uniform 2000/min budget across all endpoints. It cannot enforce GitLab's endpoint-specific limits (e.g., 60 notes/min for comment creation).

**Most concerning sub-limit:** The comment creation limit of 60/min. In practice, a user would need to submit 60 comments within a minute, which is not realistic in normal usage. Automated tools or scripts using the same OAuth token could trigger this.

**Risk level:** Low for polling; effectively zero for normal interactive use.

---

## 5. Headroom Analysis

### H1: Global Bucket Is Correctly Sized for GitLab.com, Overly Restrictive for Self-Managed

**GitLab.com:** The per-IP limit of 2,000 req/min applies to ALL traffic from the Shipyard server's IP, regardless of how many users are authenticated. This means the global token bucket at 2,000/min **correctly mirrors** the binding constraint for GitLab.com deployments. Per-user buckets would not help — the IP-level ceiling is the real bottleneck.

**Self-managed:** Rate limits are typically disabled by default. Even when enabled, the default authenticated API limit is 7,200/hour (2/sec) per user with no aggregate per-IP limit by default. The 2,000/min global cap is unnecessarily restrictive for self-managed deployments.

| Deployment | Shipyard Budget | Actual GitLab Budget | Assessment |
|------------|----------------|---------------------|------------|
| GitLab.com, 1 user | 2000/min | 2000/min (per-IP) | Correctly matched |
| GitLab.com, 10 users | 2000/min | 2000/min (per-IP) | Correctly matched |
| GitLab.com, 50 users | 2000/min | 2000/min (per-IP) | Correctly matched |
| Self-managed (defaults) | 2000/min | Unlimited (disabled) | Over-constrained |
| Self-managed (enabled) | 2000/min | 7,200/hr per user, no per-IP aggregate | Over-constrained |

### H2: Polling Interval Has Room to Tighten — But Scales With Users

**Current:** 25 seconds between polls.
**Per-user polling load:** ~2.4–12 req/min (depending on page count and whether viewing an MR).

For a **single user**, the interval could easily be reduced to 10s:
- 6 polls/min × 1 page = 6 req/min (0.3% of per-IP quota)

But because the per-IP limit is shared across all users, the headroom must be divided:

| Users | Polling at 25s | Polling at 10s | Polling at 5s |
|-------|---------------|---------------|--------------|
| 1 | ~7 req/min (0.4%) | ~18 req/min (0.9%) | ~36 req/min (1.8%) |
| 10 | ~72 req/min (3.6%) | ~180 req/min (9%) | ~360 req/min (18%) |
| 30 | ~216 req/min (11%) | ~540 req/min (27%) | ~1080 req/min (54%) |
| 50 | ~360 req/min (18%) | ~900 req/min (45%) | ~1800 req/min (90%) |

*(Assumes 1 page for MR list + 2 approval calls per user, every poll cycle)*

For small teams (< 10 users), 10s would be safe. For larger deployments, the interval should scale with user count or be adaptive.

### H3: Self-Managed Instances Are Unnecessarily Throttled

Self-managed GitLab instances typically have rate limits **disabled by default**, and even when enabled, do not impose an aggregate per-IP limit the way GitLab.com does. The Shipyard server applies the same 2000/min global cap regardless. For self-managed deployments, this cap could be relaxed or made configurable.

---

## 6. All Endpoints — Rate Limit Mapping

| # | Endpoint | Method | Trigger | Frequency | GitLab Limit | Headroom |
|---|----------|--------|---------|-----------|-------------|----------|
| 1 | `/groups/:id/merge_requests` | GET | Polling | Every 25s per user (paginated) | 2000/min (umbrella); possibly 400/min for `/groups/:id` sub-resources | Comfortable |
| 2 | `/projects/:id/merge_requests/:iid` | GET | Polling (if viewing) | Every 25s per viewed MR | 2000/min | Large |
| 3 | `/projects/:id/merge_requests/:iid/approvals` | GET | Polling (if viewing) | Every 25s per viewed MR | 2000/min | Large |
| 4 | `/projects/:id/merge_requests/:iid/approve` | POST | User action | On-demand | 2000/min | Large |
| 5 | `/projects/:id/merge_requests/:iid/unapprove` | POST | User action | On-demand | 2000/min | Large |
| 6 | `/projects/:id/merge_requests/:iid/merge` | PUT | User action | On-demand | 2000/min | Large |
| 7 | `/projects/:id/merge_requests/:iid/discussions` | GET | User action | On MR detail load (paginated) | 2000/min | Large |
| 8 | `/projects/:id/merge_requests/:iid/discussions` | POST | User action | On new comment | **60/min** (notes sub-limit) | Adequate for interactive use |
| 9 | `/projects/:id/merge_requests/:iid/discussions/:d/notes` | POST | User action | On reply | **60/min** (notes sub-limit) | Adequate for interactive use |
| 10 | `/projects/:id/merge_requests/:iid/discussions/:d` | PUT | User action | On resolve/unresolve | 2000/min | Large |
| 11 | `/projects/:id/merge_requests/:iid/notes` | GET | User action | On MR detail load (paginated) | 2000/min | Large |
| 12 | `/projects/:id/merge_requests/:iid/pipelines` | GET | User action | On MR detail load (paginated) | 2000/min | Large |
| 13 | `/projects/:id/merge_requests/:iid/commits` | GET | User action | On MR detail load (paginated) | 2000/min | Large |
| 14 | `/projects/:id/merge_requests/:iid/changes` | GET | User action | On diffs view | 2000/min; monitor for diff-specific limits | Large |
| 15 | `/projects/:id/pipelines/:pid/jobs` | GET | User action | On pipeline expand (paginated) | **600/min** (jobs endpoint) | Large |
| 16 | `/projects/:id/jobs/:jid/trace` | GET | User action | On job log view (streaming) | **200/min** (job trace) | Adequate |
| 17 | `/projects/:id/jobs/:jid` | GET | User action | On job log view (status check) | **600/min** | Large |
| 18 | `/oauth/token` | POST | Automatic | On token refresh | N/A (auth endpoint) | N/A |

---

## 7. Scenario Modeling

> **Note on limits:** For GitLab.com, the binding constraint is the **per-IP limit of 2,000 req/min**. All scenarios below are assessed against this shared IP budget. For self-managed instances (where per-IP limits are typically disabled), the per-user limits apply instead, providing substantially more headroom.

### Scenario A: Solo developer, 1 tab, 30 open MRs (GitLab.com)

| Activity | Requests/min |
|----------|-------------|
| MR list polling (1 page) | 2.4 |
| Viewed MR polling (detail + approvals) | 4.8 |
| **Steady-state total** | **~7.2** |
| On-demand burst (open MR detail) | +6–10 one-time |

**Against per-IP budget:** 7.2/2000 = 0.4%. Enormous headroom.

### Scenario B: Team of 10, all connected, 200 open MRs, 5 viewing MRs (GitLab.com)

| Activity | Requests/min |
|----------|-------------|
| MR list polling (2 pages × 10 users) | 48 |
| Viewed MR polling (5 users × 2 calls) | 24 |
| On-demand bursts (occasional) | ~10 |
| **Steady-state total** | **~82** |

**Against per-IP budget:** 82/2000 = 4.1%. Comfortable headroom, leaving 96% of per-IP budget for on-demand requests.

### Scenario C: Stress test — 50 users, 500 open MRs, 20 viewing MRs (GitLab.com)

| Activity | Requests/min |
|----------|-------------|
| MR list polling (5 pages × 50 users) | 600 |
| Viewed MR polling (20 users × 2 calls) | 96 |
| On-demand bursts | ~50 |
| **Steady-state total** | **~746** |

**Against per-IP budget:** 746/2000 = 37%. This is where the per-IP limit starts to matter. A synchronized burst (e.g., 30+ users simultaneously navigating to MR detail, each triggering 6–10 on-demand requests) could temporarily spike to 50%+ utilization. Still safe, but the safety margin is shrinking.

### Scenario D: Pathological — user opens 10 tabs (GitLab.com)

| Activity | Requests/min (this user) |
|----------|--------------------------|
| MR list polling (10 tabs × 1 page) | 24 |
| Viewed MR polling (10 tabs × 2 calls each) | 48 |
| **This user's steady-state** | **~72** |

**Against per-IP budget:** 72/2000 = 3.6% — safe in isolation but wasteful.
**Against per-user limit:** 72/2000 = 3.6% — also safe.

**Verdict:** Wasteful but not dangerous. All 10 pollers independently poll the same MR list and the same viewed MR. In a multi-user deployment, this user consumes IP budget that could serve other users' requests.

### Scenario E: Worst case — 50 users, high MR count, many tabs, frequent interactions (GitLab.com)

| Activity | Requests/min |
|----------|-------------|
| MR list polling (5 pages × 75 pollers*) | 900 |
| Viewed MR polling (30 viewing users × 2 calls × avg 1.5 tabs) | 216 |
| On-demand bursts (users browsing) | ~100 |
| **Steady-state total** | **~1216** |

*(\* 50 users averaging 1.5 tabs each = 75 SSE connections)*

**Against per-IP budget:** 1216/2000 = 61%. The rate limiter would start blocking requests during burst periods. On-demand requests (loading diffs, discussions) would experience latency as they queue behind polling requests for rate-limit tokens.

---

## 8. Recommendations

### Priority 1 — Address Vulnerabilities

1. **Deduplicate SSE connections per user.** Track active SSE connections per userId. Either refuse duplicate connections (forcing the older tab to reconnect and share) or implement a shared poller per user that fans out events to multiple SSE streams. This is the single most impactful change for multi-user deployments on GitLab.com, since every duplicate poller consumes shared per-IP budget.

2. **Add retry logic to job trace route.** Wrap the raw `fetch()` calls in `fetchWithRetry()` or at minimum handle 429s with `Retry-After` to avoid client-side retry storms.

### Priority 2 — Unlock Headroom

3. **Make the rate limit budget configurable.** The global 2,000/min bucket is correctly sized for GitLab.com (matching the per-IP limit), but overly restrictive for self-managed instances where per-IP limits are typically disabled. An environment variable (e.g., `RATE_LIMIT_PER_MINUTE`, defaulting to 2000) would let self-managed operators raise the ceiling.

4. **Make the polling interval configurable or adaptive.** Consider:
   - An environment variable to set poll interval (default 25s)
   - Adaptive polling: poll faster (e.g., 10s) when recent changes detected, slower (e.g., 30–45s) when idle
   - Scale polling interval with connected user count (e.g., 10s for 1–5 users, 25s for 6–20, 45s for 20+) to keep aggregate polling load within a safe fraction of the per-IP budget

5. **Prioritize on-demand requests over polling.** Currently, polling and on-demand requests compete equally for rate-limit tokens. A priority mechanism (e.g., reserving a portion of the budget for interactive requests) would prevent polling from starving user actions under high load.

### Priority 3 — Observability (Nice to Have)

6. **Read and log GitLab's rate limit response headers.** Extract `RateLimit-Remaining` and `RateLimit-Reset` from responses and use them to:
   - Log warnings when approaching limits
   - Optionally throttle proactively before hitting 429s
   - Note: these headers only reflect the umbrella limit, not sub-limits

7. **Add per-user request counters for diagnostics.** Track requests-per-minute per user token to help diagnose which users are consuming the most budget.

---

## 9. Conclusion

Shipyard's self-rate-limiting is **correctly sized and safe** for GitLab.com deployments. The global 2,000 req/min token bucket accurately mirrors the per-IP limit that GitLab.com enforces, which is the binding constraint for a server deployment where all requests originate from a single IP. There are no realistic scenarios in normal usage (teams up to ~30 users) where it would exceed GitLab's published rate limits.

The main vulnerability (V1, tab duplication) is wasteful rather than dangerous, but it does consume shared per-IP budget unnecessarily and becomes increasingly relevant as user count grows. Deduplicating SSE connections per user would be the highest-impact improvement.

For **self-managed GitLab** deployments, the 2,000/min cap is unnecessarily restrictive since these instances typically have no per-IP rate limit. Making the budget configurable via an environment variable would unlock substantially more throughput for self-managed operators.

The 25-second polling interval provides a good safety margin for multi-user deployments. For small teams (< 10 users) it could safely be tightened to 10–15 seconds. For larger teams, the interval should remain at 25s or scale with connected user count, since polling load is the dominant consumer of the shared per-IP budget.
