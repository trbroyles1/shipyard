import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { createLogger } from "./logger";

const log = createLogger("auth");

function gitlabUrl(): string {
  return process.env.GITLAB_URL || "https://gitlab.com";
}

// Mutex to prevent concurrent token refresh races (rotation means old refresh token is revoked)
let refreshPromise: Promise<JWT> | null = null;

async function refreshAccessToken(token: JWT): Promise<JWT> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      log.info("Refreshing access token");

      const response = await fetch(`${gitlabUrl()}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.AUTH_GITLAB_ID!,
          client_secret: process.env.AUTH_GITLAB_SECRET!,
          grant_type: "refresh_token",
          refresh_token: token.refreshToken as string,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        log.error(`Token refresh failed: ${response.status} ${JSON.stringify(data)}`);
        return { ...token, error: "RefreshAccessTokenError" };
      }

      log.info("Access token refreshed successfully");
      return {
        ...token,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
        error: undefined,
      };
    } catch (error) {
      log.error(`Token refresh error: ${error}`);
      return { ...token, error: "RefreshAccessTokenError" };
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
        url: `${process.env.GITLAB_URL || "https://gitlab.com"}/oauth/authorize`,
        params: { scope: "api" },
      },
      token: `${process.env.GITLAB_URL || "https://gitlab.com"}/oauth/token`,
      userinfo: `${process.env.GITLAB_URL || "https://gitlab.com"}/api/v4/user`,
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
      session.accessToken = token.accessToken as string;
      session.error = token.error as string | undefined;
      session.gitlabUserId = token.gitlabUserId as number;
      session.gitlabUsername = token.gitlabUsername as string;
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
