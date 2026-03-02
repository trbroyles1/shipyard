import { auth } from "@/lib/auth";
import { checkInboundRateLimit } from "@/lib/inbound-rate-limiter";

export default auth((req) => {
  if (
    req.nextUrl.pathname.startsWith("/api/gitlab") ||
    req.nextUrl.pathname.startsWith("/api/sse")
  ) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.ip ??
      "unknown";
    if (!checkInboundRateLimit(ip)) {
      return new Response("Too Many Requests", { status: 429 });
    }
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon\\.ico).*)"],
};
