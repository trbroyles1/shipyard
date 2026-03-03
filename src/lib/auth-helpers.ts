import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { auth } from "./auth";
import { env } from "./env";
import { REFRESH_TOKEN_ERROR, NOT_AUTHENTICATED_MESSAGE } from "./constants";

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
  const jwt = await getToken({ req, secret: env.AUTH_SECRET });
  if (!jwt?.accessToken) {
    throw new Error(NOT_AUTHENTICATED_MESSAGE);
  }
  return jwt.accessToken as string;
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
