import { vi } from "vitest";
import type { ReactNode } from "react";

const MOCK_SESSION = {
  gitlabUserId: 1,
  user: { name: "Test User" },
  expires: "2099-01-01T00:00:00.000Z",
};

export function useSession() {
  return { data: MOCK_SESSION, status: "authenticated" as const };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  return children;
}

export const signOut = vi.fn();
