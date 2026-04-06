import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Richie Tan — Software Engineer",
  description:
    "Ask me anything about Richie Tan. A Claude Code-inspired personal website.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh overflow-hidden bg-cc-bg font-mono text-cc-text antialiased">
        {children}
      </body>
    </html>
  );
}
