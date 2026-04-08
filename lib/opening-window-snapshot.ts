import {
  CLAUDE_FOOTER_STATUS,
  PROMPT_PLACEHOLDER,
  TERMINAL_WINDOW_TITLE,
  WELCOME_NAME,
  WELCOME_ROLE,
} from "@/lib/constants";
import type { Rect } from "@/lib/use-window-state";

const BASE_WIDTH = 800;
const BASE_HEIGHT = 600;

export function getOpeningWindowSnapshotDataUrl(rect: Pick<Rect, "width" | "height">) {
  const width = Math.max(520, Math.round(rect.width));
  const height = Math.max(380, Math.round(rect.height));
  const sx = width / BASE_WIDTH;
  const sy = height / BASE_HEIGHT;
  const scale = Math.min(sx, sy);

  const titleBarHeight = round(32 * sy);
  const terminalPaddingX = round(8 * sx);
  const prefixBaseline = round(titleBarHeight + 15 * sy);
  const welcomeTop = round(titleBarHeight + 24 * sy);
  const glyphX = round(10 * sx);
  const glyphY = round(welcomeTop + 20 * sy);
  const nameX = round(78 * sx);
  const nameY = round(welcomeTop + 28 * sy);
  const roleY = round(welcomeTop + 58 * sy);
  const dividerTop = round(titleBarHeight + 154 * sy);
  const promptTop = round(dividerTop + 16 * sy);
  const promptDividerBottom = round(promptTop + 39 * sy);
  const promptBaseline = round(promptTop + 28 * sy);
  const footerBaseline = round(promptDividerBottom + 37 * sy);
  const cursorX = round(46 * sx);
  const footerRightX = round(width - 12 * sx);
  const promptFontSize = round(12 * scale);
  const titleFontSize = round(13 * scale);
  const nameFontSize = round(24 * scale);
  const roleFontSize = round(12 * scale);
  const footerFontSize = round(12 * scale);
  const cursorWidth = round(9 * sx);
  const cursorHeight = round(22 * sy);
  const cursorTextX = round(cursorX + 2 * sx);
  const promptTextX = round(cursorX + cursorWidth);
  const placeholderFirst = PROMPT_PLACEHOLDER.slice(0, 1);
  const placeholderRest = PROMPT_PLACEHOLDER.slice(1);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">
      <rect width="${width}" height="${height}" rx="${round(10 * scale)}" fill="#171A1F"/>
      <rect width="${width}" height="${titleBarHeight}" rx="${round(10 * scale)}" fill="#323232"/>
      <path d="M0 ${round(10 * scale)}C0 ${round(4.477 * scale)} ${round(4.477 * scale)} 0 ${round(10 * scale)} 0H${round(width - 10 * scale)}C${round(width - 4.477 * scale)} 0 ${width} ${round(4.477 * scale)} ${width} ${round(10 * scale)}V${titleBarHeight}H0V${round(10 * scale)}Z" fill="#323232"/>
      <circle cx="${round(22 * sx)}" cy="${round(16 * sy)}" r="${round(7.5 * scale)}" fill="#FF5F57"/>
      <circle cx="${round(46 * sx)}" cy="${round(16 * sy)}" r="${round(7.5 * scale)}" fill="#FEBC2E"/>
      <circle cx="${round(70 * sx)}" cy="${round(16 * sy)}" r="${round(7.5 * scale)}" fill="#28C840"/>
      <text x="${round(width / 2)}" y="${round(21 * sy)}" text-anchor="middle" fill="#EBEBEB" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" font-size="${titleFontSize}" font-weight="400">${escapeXml(TERMINAL_WINDOW_TITLE)}</text>
      <g fill="#D77757" font-family="'Hack Nerd Font Mono', Menlo, Monaco, Consolas, monospace" font-size="${round(16 * scale)}" font-weight="400">
        <text x="${glyphX}" y="${glyphY}"> ▐▛███▜▌</text>
        <text x="${glyphX}" y="${round(glyphY + 16 * sy)}">▝▜█████▛▘</text>
        <text x="${glyphX}" y="${round(glyphY + 32 * sy)}">  ▘▘ ▝▝  </text>
      </g>

      <text x="${nameX}" y="${nameY}" fill="#F8F8F8" font-family="'Hack Nerd Font Mono', Menlo, Monaco, Consolas, monospace" font-size="${nameFontSize}" font-weight="600">${escapeXml(WELCOME_NAME)}</text>
      <text x="${nameX}" y="${roleY}" fill="#999999" font-family="'Hack Nerd Font Mono', Menlo, Monaco, Consolas, monospace" font-size="${roleFontSize}" font-weight="400">${escapeXml(WELCOME_ROLE)}</text>

      <rect x="0" y="${dividerTop}" width="${width}" height="${Math.max(1, round(1 * sy))}" fill="#888888"/>
      <rect x="0" y="${promptDividerBottom}" width="${width}" height="${Math.max(1, round(1 * sy))}" fill="#888888"/>

      <text x="${terminalPaddingX}" y="${promptBaseline}" fill="#F8F8F8" font-family="'Hack Nerd Font Mono', Menlo, Monaco, Consolas, monospace" font-size="${promptFontSize}" font-weight="600">❯</text>
      <rect x="${cursorX}" y="${round(promptBaseline - cursorHeight + 2 * sy)}" width="${cursorWidth}" height="${cursorHeight}" fill="#F8F8F8"/>
      <text x="${cursorTextX}" y="${promptBaseline}" fill="#171A1F" font-family="'Hack Nerd Font Mono', Menlo, Monaco, Consolas, monospace" font-size="${promptFontSize}" font-weight="400">${escapeXml(placeholderFirst)}</text>
      <text x="${promptTextX}" y="${promptBaseline}" fill="#999999" font-family="'Hack Nerd Font Mono', Menlo, Monaco, Consolas, monospace" font-size="${promptFontSize}" font-weight="400">${escapeXml(placeholderRest)}</text>

      <text x="${round(terminalPaddingX + 12 * sx)}" y="${footerBaseline}" fill="#999999" font-family="'Hack Nerd Font Mono', Menlo, Monaco, Consolas, monospace" font-size="${footerFontSize}" font-weight="400">? for shortcuts</text>
      <text x="${footerRightX}" y="${footerBaseline}" text-anchor="end" fill="#999999" font-family="'Hack Nerd Font Mono', Menlo, Monaco, Consolas, monospace" font-size="${footerFontSize}" font-weight="400">${escapeXml(CLAUDE_FOOTER_STATUS)}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
