import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import type { JWT } from "next-auth/jwt";
import type { ZodError, ZodType } from "zod";
import { auth, refreshAccessToken } from "./auth";
import { env } from "./env";
import {
  REFRESH_TOKEN_ERROR,
  NOT_AUTHENTICATED_MESSAGE,
  TOKEN_REFRESH_FAILURE_MESSAGE,
} from "./constants";

const TOKEN_REFRESH_BUFFER_SECONDS = 60;

export interface ServerAuthContext {
  accessToken: string;
  userId: number | undefined;
  expiresAt: number;
}

function shouldRefreshToken(jwt: JWT): boolean {
  if (typeof jwt.expiresAt !== "number") return false;
  return Date.now() / 1000 >= jwt.expiresAt - TOKEN_REFRESH_BUFFER_SECONDS;
}

async function resolveJWT(req: NextRequest): Promise<JWT> {
  const jwt = await getToken({ req, secret: env.AUTH_SECRET });
  if (!jwt?.accessToken) {
    throw new Error(NOT_AUTHENTICATED_MESSAGE);
  }

  if (!shouldRefreshToken(jwt)) {
    return jwt;
  }

  const refreshed = await refreshAccessToken(jwt);
  if (!refreshed.accessToken || refreshed.error === REFRESH_TOKEN_ERROR) {
    throw new Error(`${TOKEN_REFRESH_FAILURE_MESSAGE} — re-authentication required`);
  }

  return refreshed;
}

export async function resolveServerAuth(req: NextRequest): Promise<ServerAuthContext> {
  const jwt = await resolveJWT(req);
  return {
    accessToken: jwt.accessToken as string,
    userId: jwt.gitlabUserId as number | undefined,
    expiresAt: typeof jwt.expiresAt === "number" ? jwt.expiresAt : 0,
  };
}

export async function getAuthenticatedSession() {
  const session = await auth();
  if (!session) {
    throw new Error(NOT_AUTHENTICATED_MESSAGE);
  }
  if (session.error === REFRESH_TOKEN_ERROR) {
    throw new Error("Token refresh failed — re-authentication required");
  }
  return session;
}

export async function getAccessToken(req: NextRequest): Promise<string> {
  const resolved = await resolveServerAuth(req);
  return resolved.accessToken;
}

const DEFAULT_MAX_BYTES = 1_048_576; // 1 MB

function validationErrorResponse(zodError: ZodError): NextResponse {
  const message = zodError.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
  return NextResponse.json(
    { error: message || "Invalid request body", code: "validation_error" },
    { status: 400 },
  );
}

export async function parseBody<T>(
  req: Request,
  schema: ZodType<T>,
  maxBytes: number = DEFAULT_MAX_BYTES,
): Promise<{ data: T } | { error: NextResponse }> {
  const contentLength = req.headers.get("content-length");
  if (contentLength && Number.parseInt(contentLength, 10) > maxBytes) {
    return { error: NextResponse.json({ error: "Request body too large" }, { status: 413 }) };
  }

  let text: string;
  try {
    text = await req.text();
  } catch {
    return { error: NextResponse.json({ error: "Failed to read request body" }, { status: 400 }) };
  }

  if (!text || text.trim() === "") {
    const result = schema.safeParse({});
    if (!result.success) {
      return { error: validationErrorResponse(result.error) };
    }
    return { data: result.data };
  }

  if (text.length > maxBytes) {
    return { error: NextResponse.json({ error: "Request body too large" }, { status: 413 }) };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return { error: validationErrorResponse(result.error) };
  }
  return { data: result.data };
}
