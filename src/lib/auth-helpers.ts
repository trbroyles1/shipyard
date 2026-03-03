import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import type { JWT } from "next-auth/jwt";
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

export async function parseBody<T = Record<string, unknown>>(
  req: Request,
  maxBytes: number = DEFAULT_MAX_BYTES,
): Promise<{ data: T } | { error: NextResponse }> {
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    return { error: NextResponse.json({ error: "Request body too large" }, { status: 413 }) };
  }

  let text: string;
  try {
    text = await req.text();
  } catch {
    return { error: NextResponse.json({ error: "Failed to read request body" }, { status: 400 }) };
  }

  if (!text || text.trim() === "") {
    return { data: {} as T };
  }

  if (text.length > maxBytes) {
    return { error: NextResponse.json({ error: "Request body too large" }, { status: 413 }) };
  }

  try {
    return { data: JSON.parse(text) as T };
  } catch {
    return { error: NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) };
  }
}
