import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { createLogger } from "./logger";
import { env } from "./env";
import { REFRESH_TOKEN_ERROR, SIGN_IN_PATH, GITLAB_API_VERSION_PATH } from "./constants";

const log = createLogger("auth");

const TOKEN_REFRESH_TIMEOUT_MS = 15_000;
const TOKEN_REFRESH_RETRY_DELAY_MS = 2_000;
const TRANSIENT_REFRESH_STATUSES = [500, 502, 503, 504] as const;

// Mutex to prevent concurrent token refresh races (rotation means old refresh token is revoked)
let refreshPromise: Promise<JWT> | null = null;

function isTransientRefreshFailure(status: number): boolean {
  return (TRANSIENT_REFRESH_STATUSES as readonly number[]).includes(status);
}

function isNetworkOrTimeoutError(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError"))
  );
}

async function attemptTokenRefresh(token: JWT): Promise<JWT> {
  const response = await fetch(`${env.GITLAB_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GITLAB_ID!,
      client_secret: process.env.AUTH_GITLAB_SECRET!,
      grant_type: "refresh_token",
      refresh_token: token.refreshToken as string,
    }),
    signal: AbortSignal.timeout(TOKEN_REFRESH_TIMEOUT_MS),
  });

  let data: Record<string, unknown>;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Malformed JSON from token endpoint (status ${response.status})`);
  }

  if (!response.ok) {
    if (isTransientRefreshFailure(response.status)) {
      throw new Error(`Transient token refresh failure: ${response.status}`);
    }
    log.error(`Token refresh failed: ${response.status} error=${data.error} description=${data.error_description}`);
    return { ...token, error: REFRESH_TOKEN_ERROR };
  }

  log.info("Access token refreshed successfully");
  return {
    ...token,
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string,
    expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in as number),
    error: undefined,
  };
}

export async function refreshAccessToken(token: JWT): Promise<JWT> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      log.info("Refreshing access token");
      return await attemptTokenRefresh(token);
    } catch (error) {
      if (isNetworkOrTimeoutError(error) || (error instanceof Error && error.message.startsWith("Transient")) || (error instanceof Error && error.message.startsWith("Malformed"))) {
        log.warn(`Token refresh transient error, retrying in ${TOKEN_REFRESH_RETRY_DELAY_MS}ms: ${error}`);
        await new Promise((resolve) => setTimeout(resolve, TOKEN_REFRESH_RETRY_DELAY_MS));
        try {
          return await attemptTokenRefresh(token);
        } catch (retryError) {
          log.error(`Token refresh retry failed: ${retryError}`);
          return { ...token, error: REFRESH_TOKEN_ERROR };
        }
      }
      log.error(`Token refresh error: ${error}`);
      return { ...token, error: REFRESH_TOKEN_ERROR };
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export const authConfig: NextAuthConfig = {
  providers: [
    {
      id: "gitlab",
      name: "GitLab",
      type: "oauth",
      clientId: process.env.AUTH_GITLAB_ID,
      clientSecret: process.env.AUTH_GITLAB_SECRET,
      authorization: {
        url: `${env.GITLAB_URL}/oauth/authorize`,
        params: { scope: "api" },
      },
      token: `${env.GITLAB_URL}/oauth/token`,
      userinfo: `${env.GITLAB_URL}${GITLAB_API_VERSION_PATH}/user`,
      profile(profile) {
        return {
          id: String(profile.id),
          name: profile.name ?? profile.username,
          email: profile.email,
          image: profile.avatar_url,
        };
      },
    },
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      // Initial sign-in: store tokens + GitLab identity
      if (account) {
        log.info(`User signed in: ${token.name}`);
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
          // GitLab OAuth provider guarantees `id` (number) and `username` (string) on the profile
          gitlabUserId: (profile as unknown as { id: number })?.id,
          gitlabUsername: (profile as unknown as { username: string })?.username,
        };
      }

      // Return token if not expired (with 60s buffer)
      if (typeof token.expiresAt === "number" && Date.now() / 1000 < token.expiresAt - 60) {
        return token;
      }

      // Token expired — refresh
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.error = token.error as string | undefined;
      session.gitlabUserId = token.gitlabUserId as number;
      session.gitlabUsername = token.gitlabUsername as string;
      return session;
    },
  },
  pages: {
    signIn: SIGN_IN_PATH,
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
