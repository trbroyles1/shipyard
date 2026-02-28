import { env } from "./env";
import { createLogger } from "./logger";
import { acquire } from "./rate-limiter";

const log = createLogger("gitlab-client");

export class GitLabApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: string,
  ) {
    super(`GitLab API error ${status}: ${statusText}`);
    this.name = "GitLabApiError";
  }
}

interface FetchOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
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

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    log.error(`GitLab API ${response.status} on ${method} ${path}: ${errorBody}`);
    throw new GitLabApiError(response.status, response.statusText, errorBody);
  }

  return response.json() as Promise<T>;
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
): Promise<T[]> {
  const results: T[] = [];
  let page = 1;

  while (true) {
    await acquire();

    const searchParams = new URLSearchParams({ ...params, page: String(page), per_page: "100" });
    const url = `${env.GITLAB_URL}/api/v4${path}?${searchParams}`;

    log.debug(`GET ${path} (page ${page})`);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      log.error(`GitLab API ${response.status} on GET ${path}: ${errorBody}`);
      throw new GitLabApiError(response.status, response.statusText, errorBody);
    }

    const data = (await response.json()) as T[];
    results.push(...data);

    const totalPages = parseInt(response.headers.get("x-total-pages") || "1", 10);
    if (page >= totalPages) break;
    page++;
  }

  return results;
}
