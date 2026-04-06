"use client";

import { CLAUDE_CWD } from "@/lib/constants";

const LOGO_LINES = [
  " ▄████▄ ",
  "██▀  ▀██",
  "████████",
  "██ ██ ██",
  "▀▀    ▀▀",
];

function padRight(value: string, width: number) {
  return value + " ".repeat(Math.max(0, width - value.length));
}

export function Welcome() {
  const logoWidth = Math.max(...LOGO_LINES.map((line) => line.length));

  return (
    <div className="select-none px-1 pt-1 pb-2 text-[13px] leading-5">
      <pre className="m-0 whitespace-pre-wrap break-words text-[#6fd4cf]">
        › {CLAUDE_CWD}
      </pre>
      <pre className="m-0 whitespace-pre-wrap break-words text-[#7cc86c]">
        ↳ claude
      </pre>

      <div className="mt-2 flex items-start gap-4">
        <pre className="m-0 whitespace-pre text-cc-claude">
          {LOGO_LINES.join("\n")}
        </pre>
        <pre className="m-0 whitespace-pre-wrap break-words text-cc-text">
          <span className="font-semibold">
            {padRight("Claude Code", 12)}
          </span>
          <span className="text-cc-secondary">browser build</span>
          {"\n"}
          <span className="text-cc-secondary">
            Claude Sonnet 4.6 · Richie portfolio assistant
          </span>
          {"\n"}
          <span className="text-cc-secondary">
            {padRight(CLAUDE_CWD, Math.max(logoWidth, CLAUDE_CWD.length))}
          </span>
        </pre>
      </div>
    </div>
  );
}
