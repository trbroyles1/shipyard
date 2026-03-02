import { env } from "./env";
import { createLogger } from "./logger";
import { acquire } from "./rate-limiter";
import { GitLabApiError, isTransientError } from "./errors";

export { GitLabApiError } from "./errors";

const log = createLogger("gitlab-client");

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 10_000;
const DEFAULT_MAX_PAGES = 50;

interface FetchOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Executes a fetch with automatic timeout, retry on transient errors,
 * and exponential backoff with jitter. Returns a successful Response.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  callerSignal?: AbortSignal,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (callerSignal?.aborted) {
      throw callerSignal.reason ?? new DOMException("Aborted", "AbortError");
    }

    const timeoutSignal = AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
    const signal = callerSignal
      ? AbortSignal.any([callerSignal, timeoutSignal])
      : timeoutSignal;

    try {
      const response = await fetch(url, { ...init, signal });

      if (response.ok) {
        return response;
      }

      const errorBody = await response.text();
      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;

      const error = new GitLabApiError(
        response.status,
        response.statusText,
        errorBody,
        Number.isFinite(retryAfter) ? retryAfter : undefined,
      );

      if (!isTransientError(error)) {
        throw error;
      }

      lastError = error;

      if (attempt < MAX_RETRIES) {
        // Honor server's Retry-After for 429s without capping — GitLab sets reasonable values
        // and we should respect rate-limit signals to avoid escalating to longer bans.
        const backoff = response.status === 429 && Number.isFinite(retryAfter)
          ? retryAfter! * 1_000
          : Math.min(INITIAL_BACKOFF_MS * Math.pow(2, attempt), MAX_BACKOFF_MS) *
            (0.5 + Math.random() * 0.5);
        log.warn(`Transient error ${response.status} on ${init.method ?? "GET"} ${url}, retrying in ${Math.round(backoff)}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    } catch (err) {
      if (err instanceof GitLabApiError && !isTransientError(err)) {
        throw err;
      }

      lastError = err;

      if (attempt < MAX_RETRIES && isTransientError(err)) {
        const backoff =
          Math.min(INITIAL_BACKOFF_MS * Math.pow(2, attempt), MAX_BACKOFF_MS) *
          (0.5 + Math.random() * 0.5);
        log.warn(`Fetch error (${err instanceof Error ? err.message : err}), retrying in ${Math.round(backoff)}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      } else if (!isTransientError(err)) {
        throw err;
      }
    }
  }

  throw lastError;
}

function safeParseJSON<T>(rawText: string): T {
  try {
    return JSON.parse(rawText) as T;
  } catch {
    throw new GitLabApiError(502, "Invalid JSON response", rawText);
  }
}

export async function gitlabFetch<T = unknown>(
  path: string,
  token: string,
  options: FetchOptions = {},
): Promise<T> {
  await acquire();

  const url = `${env.GITLAB_URL}/api/v4${path}`;
  const { method = "GET", body, headers = {}, signal } = options;

  log.debug(`${method} ${path}`);

  const response = await fetchWithRetry(
    url,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    },
    signal,
  );

  const text = await response.text();
  return safeParseJSON<T>(text);
}

export interface PaginatedResult<T> {
  data: T[];
  nextPage: number | null;
  totalPages: number;
}

export async function gitlabFetchAllPages<T>(
  path: string,
  token: string,
  params: Record<string, string> = {},
  maxPages: number = DEFAULT_MAX_PAGES,
): Promise<T[]> {
  const results: T[] = [];
  let page = 1;

  while (true) {
    await acquire();

    const searchParams = new URLSearchParams({ ...params, page: String(page), per_page: "100" });
    const url = `${env.GITLAB_URL}/api/v4${path}?${searchParams}`;

    log.debug(`GET ${path} (page ${page})`);

    const response = await fetchWithRetry(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const text = await response.text();
    const data = safeParseJSON<T[]>(text);
    results.push(...data);

    const totalPages = parseInt(response.headers.get("x-total-pages") || "1", 10);
    if (page >= totalPages) break;
    page++;
    if (page > maxPages) {
      log.warn(`Pagination limit reached (${maxPages} pages) for ${path}`);
      break;
    }
  }

  return results;
}
