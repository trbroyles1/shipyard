export const AUTH_EXPIRED_EVENT = "shipyard:auth-expired";

/**
 * Wraps fetch(). On 401 response, dispatches AUTH_EXPIRED_EVENT on window so
 * any component can trigger the sign-out flow without importing signOut.
 * Returns the Response as-is so callers can still inspect status/body.
 */
export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(url, init);
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  }
  return response;
}

/** Extract a user-friendly message from an API error response body. */
export function userFriendlyMessage(body: Record<string, unknown>, fallback: string): string {
  if (typeof body.error === "string" && body.error.length > 0) return body.error;
  return fallback;
}

/**
 * Read an error payload from a non-ok Response and throw it as an Error.
 * Replaces the repeated `res.json().catch(() => ({})) + throw` pattern.
 */
export async function throwResponseError(res: Response, fallback?: string): Promise<never> {
  const data: Record<string, unknown> = await res.json().catch(() => ({}));
  throw new Error(userFriendlyMessage(data, fallback ?? `HTTP ${res.status}`));
}
