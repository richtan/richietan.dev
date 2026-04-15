import { Analytics } from "@vercel/analytics/next";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import { hackNerdMono } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Richie Tan — Software Engineer",
  description:
    "Ask me anything about Richie Tan. A Claude Code-inspired personal website.",
};

const FALLBACK_BACKGROUND =
  "linear-gradient(135deg, #1a1a2e 0%, #16213e 52%, #0f3460 100%)";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${hackNerdMono.variable}`}>
      <body
        className="min-h-dvh overflow-hidden text-cc-text antialiased"
        style={{ background: FALLBACK_BACKGROUND }}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
