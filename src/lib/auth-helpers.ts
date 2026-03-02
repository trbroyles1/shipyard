import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { auth } from "./auth";

export async function getAuthenticatedSession() {
  const session = await auth();
  if (!session) {
    throw new Error("Not authenticated");
  }
  if (session.error === "RefreshAccessTokenError") {
    throw new Error("Token refresh failed — re-authentication required");
  }
  return session;
}

export async function getAccessToken(req: NextRequest): Promise<string> {
  const jwt = await getToken({ req, secret: process.env.AUTH_SECRET });
  if (!jwt?.accessToken) {
    throw new Error("Not authenticated");
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
