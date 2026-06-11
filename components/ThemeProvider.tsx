"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * ThemeProvider — wraps the app with next-themes for Light/Dark mode toggling.
 * Uses `data-theme` attribute on <html> so our CSS variables respond correctly.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange={false}
    >
      {children}
    </NextThemesProvider>
  );
}
