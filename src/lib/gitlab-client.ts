import { env } from "./env";
import { createLogger } from "./logger";
import { acquire } from "./rate-limiter";
import { GitLabApiError, isTransientError } from "./errors";
import { GITLAB_DEFAULT_PER_PAGE, GITLAB_FETCH_TIMEOUT_MS, GITLAB_API_VERSION_PATH } from "./constants";

export { GitLabApiError } from "./errors";

const log = createLogger("gitlab-client");

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
 * Computes backoff duration in ms. Honors Retry-After for 429s without
 * capping — GitLab sets reasonable values and we should respect rate-limit
 * signals to avoid escalating to longer bans.
 */
function calculateBackoff(attempt: number, status?: number, retryAfter?: number): number {
  if (status === 429 && Number.isFinite(retryAfter)) {
    return retryAfter! * 1_000;
  }
  return Math.min(INITIAL_BACKOFF_MS * Math.pow(2, attempt), MAX_BACKOFF_MS) *
    (0.5 + Math.random() * 0.5);
}

async function buildGitLabError(response: Response): Promise<GitLabApiError> {
  const errorBody = await response.text();
  const retryAfterHeader = response.headers.get("retry-after");
  const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
  return new GitLabApiError(
    response.status,
    response.statusText,
    errorBody,
    Number.isFinite(retryAfter) ? retryAfter : undefined,
  );
}

/**
 * If the error is not transient, throws immediately. Otherwise, if retries
 * remain, logs a warning and waits with exponential backoff before returning.
 */
async function handleRetryableError(
  error: unknown,
  attempt: number,
  url: string,
  method: string,
): Promise<void> {
  if (!isTransientError(error)) {
    throw error;
  }
  if (attempt >= MAX_RETRIES) return;

  const status = error instanceof GitLabApiError ? error.status : undefined;
  const retryAfter = error instanceof GitLabApiError ? error.retryAfter : undefined;
  const backoff = calculateBackoff(attempt, status, retryAfter);
  const description = error instanceof Error ? error.message : String(error);
  log.warn(`${description} on ${method} ${url}, retrying in ${Math.round(backoff)}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
  await new Promise((resolve) => setTimeout(resolve, backoff));
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
  const method = init.method ?? "GET";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (callerSignal?.aborted) {
      throw callerSignal.reason ?? new DOMException("Aborted", "AbortError");
    }

    const timeoutSignal = AbortSignal.timeout(GITLAB_FETCH_TIMEOUT_MS);
    const signal = callerSignal
      ? AbortSignal.any([callerSignal, timeoutSignal])
      : timeoutSignal;

    try {
      const response = await fetch(url, { ...init, signal });
      if (response.ok) return response;

      const error = await buildGitLabError(response);
      lastError = error;
      await handleRetryableError(error, attempt, url, method);
    } catch (err) {
      if (err instanceof GitLabApiError && !isTransientError(err)) throw err;
      lastError = err;
      await handleRetryableError(err, attempt, url, method);
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

  const url = `${env.GITLAB_URL}${GITLAB_API_VERSION_PATH}${path}`;
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

    const searchParams = new URLSearchParams({ ...params, page: String(page), per_page: String(GITLAB_DEFAULT_PER_PAGE) });
    const url = `${env.GITLAB_URL}${GITLAB_API_VERSION_PATH}${path}?${searchParams}`;

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
