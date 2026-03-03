import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Outfit, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { PREFS_COOKIE_NAME } from "@/lib/constants";
import { DEFAULT_PREFERENCES, isTheme } from "@/lib/types/preferences";
import type { Theme } from "@/lib/types/preferences";
import "./globals.css";

/**
 * Theme-specific font override pattern:
 * 1. Import from next/font/google (or next/font/local)
 * 2. Assign a `variable` option (e.g. "--font-my-sans")
 * 3. Append `.variable` to the <html> className below
 * 4. Override --sans or --mono in the theme CSS file using var(--font-my-sans, ...)
 *
 * All theme fonts load unconditionally via @font-face at build time; the browser
 * only downloads woff2 files when a CSS rule actually references the font family,
 * so unused fonts cost nothing.
 */
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

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Shipyard",
  description: "GitLab merge request review dashboard",
};

function readThemeFromCookie(cookieStore: Awaited<ReturnType<typeof cookies>>): Theme {
  const raw = cookieStore.get(PREFS_COOKIE_NAME)?.value;
  if (!raw) return DEFAULT_PREFERENCES.theme;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    const theme = typeof parsed === "object" && parsed !== null ? (parsed as { theme?: unknown }).theme : undefined;
    return isTheme(theme) ? theme : DEFAULT_PREFERENCES.theme;
  } catch {
    return DEFAULT_PREFERENCES.theme;
  }
}

export default async function RootLayout(
  {
    children,
  }: {
    children: React.ReactNode;
  }
) {
  const cookieStore = await cookies();
  const theme = readThemeFromCookie(cookieStore);

  return (
    <html
      lang="en"
      className={`${outfit.variable} ${jetbrainsMono.variable} ${plusJakartaSans.variable}`}
      data-theme={theme}
    >
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
