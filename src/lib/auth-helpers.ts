import { auth } from "./auth";

export async function getAuthenticatedSession() {
  const session = await auth();
  if (!session?.accessToken) {
    throw new Error("Not authenticated");
  }
  if (session.error === "RefreshAccessTokenError") {
    throw new Error("Token refresh failed — re-authentication required");
  }
  return session;
}

export function extractAccessToken(session: { accessToken?: string }): string {
  if (!session.accessToken) {
    throw new Error("No access token in session");
  }
  return session.accessToken;
}
