import { NextResponse } from "next/server";
import { GitLabApiError } from "./gitlab-client";
import { ValidationError } from "./validation";
import { type createLogger } from "./logger";

type Logger = ReturnType<typeof createLogger>;

const CODE_NOT_AUTHENTICATED = "not_authenticated";
const CODE_TOKEN_EXPIRED = "token_expired";
const CODE_FORBIDDEN = "forbidden";
const CODE_NOT_FOUND = "not_found";
const CODE_VALIDATION = "validation_error";
const CODE_CONFLICT = "conflict";
const CODE_RATE_LIMITED = "rate_limited";
const CODE_GITLAB_UNAVAILABLE = "gitlab_unavailable";
const CODE_INTERNAL = "internal_error";

const MSG_SESSION_EXPIRED = "Your GitLab session has expired";
const MSG_FORBIDDEN = "You don't have permission for this action";
const MSG_NOT_FOUND = "Resource not found or not accessible";
const MSG_TIMEOUT = "GitLab timed out — please try again";
const MSG_CONFLICT = "Conflict — the resource may have been modified";
const MSG_RATE_LIMITED = "Too many requests — please wait a moment";
const MSG_GITLAB_UNAVAILABLE = "GitLab is temporarily unavailable";
const MSG_INTERNAL = "Internal server error";
const MSG_VALIDATION_DEFAULT_400 = "Invalid request";
const MSG_VALIDATION_DEFAULT_422 = "Request could not be processed";

function tryParseGitLabMessage(body: string): string | null {
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed.message === "string") return parsed.message;
    if (Array.isArray(parsed.message)) return parsed.message.join("; ");
    if (typeof parsed.error === "string") return parsed.error;
  } catch {
    // Body is not JSON — fall through
  }
  return null;
}

function mapGitLabError(
  status: number,
  body: string,
): { error: string; code: string; status: number } {
  switch (status) {
    case 400:
      return {
        error: tryParseGitLabMessage(body) ?? MSG_VALIDATION_DEFAULT_400,
        code: CODE_VALIDATION,
        status: 400,
      };
    case 401:
      return { error: MSG_SESSION_EXPIRED, code: CODE_NOT_AUTHENTICATED, status: 401 };
    case 403:
      return { error: MSG_FORBIDDEN, code: CODE_FORBIDDEN, status: 403 };
    case 404:
      return { error: MSG_NOT_FOUND, code: CODE_NOT_FOUND, status: 404 };
    case 408:
      return { error: MSG_TIMEOUT, code: CODE_GITLAB_UNAVAILABLE, status: 408 };
    case 409:
      return { error: MSG_CONFLICT, code: CODE_CONFLICT, status: 409 };
    case 422:
      return {
        error: tryParseGitLabMessage(body) ?? MSG_VALIDATION_DEFAULT_422,
        code: CODE_VALIDATION,
        status: 422,
      };
    case 429:
      return { error: MSG_RATE_LIMITED, code: CODE_RATE_LIMITED, status: 429 };
    default:
      if (status >= 500) {
        return { error: MSG_GITLAB_UNAVAILABLE, code: CODE_GITLAB_UNAVAILABLE, status: 502 };
      }
      return { error: MSG_INTERNAL, code: CODE_INTERNAL, status };
  }
}

const AUTH_ERROR_SUBSTRINGS = ["Not authenticated", "No access token"] as const;
const TOKEN_REFRESH_SUBSTRING = "Token refresh failed";

export function handleApiRouteError(error: unknown, log: Logger): NextResponse {
  if (error instanceof ValidationError) {
    log.warn(`Validation error: ${error.message}`);
    return NextResponse.json(
      { error: error.message, code: CODE_VALIDATION },
      { status: 400 },
    );
  }

  if (error instanceof GitLabApiError) {
    const mapped = mapGitLabError(error.status, error.body);
    log.warn(`GitLab API ${error.status}: ${mapped.error}`);
    return NextResponse.json(
      { error: mapped.error, code: mapped.code },
      { status: mapped.status },
    );
  }

  if (error instanceof Error) {
    if (error.message.includes(TOKEN_REFRESH_SUBSTRING)) {
      log.warn(`Auth error: ${error.message}`);
      return NextResponse.json(
        { error: MSG_SESSION_EXPIRED, code: CODE_TOKEN_EXPIRED },
        { status: 401 },
      );
    }

    for (const substring of AUTH_ERROR_SUBSTRINGS) {
      if (error.message.includes(substring)) {
        log.warn(`Auth error: ${error.message}`);
        return NextResponse.json(
          { error: MSG_SESSION_EXPIRED, code: CODE_NOT_AUTHENTICATED },
          { status: 401 },
        );
      }
    }
  }

  log.error(`Unexpected error: ${error}`);
  return NextResponse.json(
    { error: MSG_INTERNAL, code: CODE_INTERNAL },
    { status: 500 },
  );
}
