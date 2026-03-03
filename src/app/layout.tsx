import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Outfit, JetBrains_Mono } from "next/font/google";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { DEFAULT_PREFERENCES, isTheme } from "@/lib/types/preferences";
import type { Theme } from "@/lib/types/preferences";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Shipyard",
  description: "GitLab merge request review dashboard",
};

function readThemeFromCookie(cookieStore: ReturnType<typeof cookies>): Theme {
  const raw = cookieStore.get("shipyard_prefs")?.value;
  if (!raw) return DEFAULT_PREFERENCES.theme;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    const theme = typeof parsed === "object" && parsed !== null ? (parsed as { theme?: unknown }).theme : undefined;
    return isTheme(theme) ? theme : DEFAULT_PREFERENCES.theme;
  } catch {
    return DEFAULT_PREFERENCES.theme;
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = cookies();
  const theme = readThemeFromCookie(cookieStore);

  return (
    <html
      lang="en"
      className={`${outfit.variable} ${jetbrainsMono.variable}`}
      data-theme={theme}
    >
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
