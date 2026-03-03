/** Centralized string constants, grouped by domain. */

// ---------------------------------------------------------------------------
// API paths
// ---------------------------------------------------------------------------

/** Base path for client-side MR API requests. */
export const MR_API_BASE_PATH = "/api/gitlab/merge-requests";

/** GitLab REST API version prefix. */
export const GITLAB_API_VERSION_PATH = "/api/v4";

export const GITLAB_API_PATH_PREFIX = "/api/gitlab";
export const SSE_API_PATH_PREFIX = "/api/sse";
export const AUTH_API_PATH_PREFIX = "/api/auth";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/** Error sentinel stored on the JWT when a token refresh fails permanently. */
export const REFRESH_TOKEN_ERROR = "RefreshAccessTokenError";

/** Path to the sign-in page (configured in Auth.js `pages`). */
export const SIGN_IN_PATH = "/auth/signin";

/**
 * Error message substrings thrown by auth-helpers that indicate the user's
 * session is missing or invalid. Used by `api-error-handler` for matching.
 */
export const AUTH_ERROR_MESSAGES = ["Not authenticated", "No access token"] as const;

export const NOT_AUTHENTICATED_MESSAGE = AUTH_ERROR_MESSAGES[0];

/** Error message prefix for token-refresh failures. */
export const TOKEN_REFRESH_FAILURE_MESSAGE = "Token refresh failed";

// ---------------------------------------------------------------------------
// Merge status
// ---------------------------------------------------------------------------

export const MERGE_STATUS_MERGEABLE = "mergeable";

// ---------------------------------------------------------------------------
// SSE
// ---------------------------------------------------------------------------

export const SSE_RESPONSE_HEADERS: Record<string, string> = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

// ---------------------------------------------------------------------------
// HTTP headers
// ---------------------------------------------------------------------------

/** Custom header carrying the CI job status alongside trace responses. */
export const HEADER_JOB_STATUS = "X-Job-Status";

// ---------------------------------------------------------------------------
// Cookies
// ---------------------------------------------------------------------------

export const PREFS_COOKIE_NAME = "shipyard_prefs";
export const COOKIE_MAX_AGE_1Y = 60 * 60 * 24 * 365;

// ---------------------------------------------------------------------------
// GitLab defaults
// ---------------------------------------------------------------------------

export const GITLAB_DEFAULT_PER_PAGE = 100;
export const GITLAB_FETCH_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Error messages
// ---------------------------------------------------------------------------

/** Fallback when an error isn't an Error instance and has no message. */
export const FALLBACK_ERROR_MESSAGE = "Unknown error";
