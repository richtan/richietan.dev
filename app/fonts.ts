import localFont from "next/font/local";

export const hackNerdMono = localFont({
  src: [
    {
      path: "./fonts/HackNerdFontMono-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/HackNerdFontMono-Italic.ttf",
      weight: "400",
      style: "italic",
    },
    {
      path: "./fonts/HackNerdFontMono-Bold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/HackNerdFontMono-BoldItalic.ttf",
      weight: "700",
      style: "italic",
    },
  ],
  variable: "--font-hack-nerd-mono",
  fallback: ["monospace"],
  adjustFontFallback: false,
});
