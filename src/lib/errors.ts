export class GitLabApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: string,
    public retryAfter?: number,
  ) {
    super(`GitLab API error ${status}: ${statusText}`);
    this.name = "GitLabApiError";
  }
}

export const TRANSIENT_STATUSES = [408, 429, 500, 502, 503, 504] as const;
export const AUTH_FAILURE_STATUSES = [401] as const;

export function isTransientError(error: unknown): boolean {
  if (error instanceof GitLabApiError) {
    return (TRANSIENT_STATUSES as readonly number[]).includes(error.status);
  }
  if (error instanceof TypeError) return true;
  if (error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError")) return true;
  return false;
}

export function isAuthError(error: unknown): boolean {
  return (
    error instanceof GitLabApiError &&
    (AUTH_FAILURE_STATUSES as readonly number[]).includes(error.status)
  );
}

// SSE error/warning codes
export const SSE_ERROR_AUTH_EXPIRED = "auth_expired";
export const SSE_ERROR_GITLAB_UNAVAILABLE = "gitlab_unavailable";
export const SSE_WARNING_POLL_FAILED = "poll_failed";
export const SSE_ERROR_SESSION_DISPLACED = "session_displaced";
export const SSE_EVENT_SESSION_DISPLACED = "session-displaced" as const;
