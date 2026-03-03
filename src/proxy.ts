import { auth } from "@/lib/auth";
import { apiRateLimiter, authRateLimiter } from "@/lib/inbound-rate-limiter";
import {
  AUTH_API_PATH_PREFIX,
  GITLAB_API_PATH_PREFIX,
  SSE_API_PATH_PREFIX,
} from "@/lib/constants";

export const proxy = auth((req) => {
  const pathname = req.nextUrl.pathname;
  const isApi =
    pathname.startsWith(GITLAB_API_PATH_PREFIX) ||
    pathname.startsWith(SSE_API_PATH_PREFIX);
  const isAuth = pathname.startsWith(AUTH_API_PATH_PREFIX);

  if (isApi || isAuth) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const limiter = isAuth ? authRateLimiter : apiRateLimiter;
    if (!limiter.check(ip)) {
      return new Response("Too Many Requests", { status: 429 });
    }
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
