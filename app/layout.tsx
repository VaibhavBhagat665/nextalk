import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "NexTalk — Premium Real-Time Chat",
  description:
    "Premium real-time chat with AI-powered thread summaries, file sharing, and end-to-end encryption.",
  keywords: ["chat", "real-time", "messaging", "AI", "collaboration", "team", "enterprise"],
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#8B7D6B",
          colorBackground: "#1A1714",
          colorInputBackground: "#231F1B",
          colorInputText: "#F2EDE7",
          colorText: "#F2EDE7",
          colorTextSecondary: "#8A827A",
        },
      }}
    >
      <html lang="en" suppressHydrationWarning data-theme="dark" className="dark">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Comic+Neue:wght@300;400;700&family=JetBrains+Mono:wght@400;500&display=swap"
            rel="stylesheet"
          />
        </head>
        <body>
          <ThemeProvider>{children}</ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
