import { Analytics } from "@vercel/analytics/next";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import { hackNerdMono } from "./fonts";
import "./globals.css";

const SITE_TITLE = "Richie Tan — Software Engineer";
const SITE_DESCRIPTION =
  "Richie Tan is a software engineer studying CS at Purdue (December 2026). Ask anything about his work in a Claude Code-style terminal.";

export const metadata: Metadata = {
  metadataBase: new URL("https://richietan.dev"),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: "Richie Tan",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
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
