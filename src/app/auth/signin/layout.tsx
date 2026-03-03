import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In - Shipyard",
};

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children;
}
