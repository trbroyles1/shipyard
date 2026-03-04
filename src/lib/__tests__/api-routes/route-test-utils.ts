import { NextRequest } from "next/server";

/** Base URL used only to construct valid Request/NextRequest objects. */
const BASE_URL = "http://localhost:3000";

export const GITLAB_URL = "https://gitlab.test";
export const GITLAB_API = `${GITLAB_URL}/api/v4`;
export const GITLAB_GROUP_ID = "99";
export const TEST_TOKEN = "test-token";
export const TEST_USER_ID = 1;
export const VALID_PROJECT_ID = "42";
export const VALID_IID = "17";
export const VALID_DISCUSSION_ID = "a".repeat(40);
export const VALID_PIPELINE_ID = "100";

/** Sets the env vars that route handlers read at runtime. */
export function setupRouteTestEnv(): void {
  process.env.GITLAB_URL = GITLAB_URL;
  process.env.GITLAB_GROUP_ID = GITLAB_GROUP_ID;
}

/** Constructs the Next.js 16 async-params object expected by route handlers. */
export function routeParams<T extends Record<string, string>>(
  params: T,
): { params: Promise<T> } {
  return { params: Promise.resolve(params) };
}

export function createGETRequest(path: string): NextRequest {
  return new NextRequest(`${BASE_URL}${path}`);
}

export function createPOSTRequest(path: string, body: unknown): NextRequest {
  return new NextRequest(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function createPUTRequest(path: string, body: unknown): NextRequest {
  return new NextRequest(`${BASE_URL}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function parseJSONResponse(
  response: Response,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const body = await response.json();
  return { status: response.status, body };
}
