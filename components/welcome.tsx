"use client";

import {
  CLAUDE_CWD,
  CLAUDE_HEADER_SUBTITLE,
  CLAUDE_HEADER_TITLE,
} from "@/lib/constants";

const LOGO_LINES = [
  " ▄█████▄ ",
  "██ ▄▄▄ ██",
  "█████████",
  "██ █ █ ██",
  "██ █ █ ██",
];

export function Welcome() {
  return (
    <div className="select-none px-1 pt-1 pb-2">
      <pre className="m-0 whitespace-pre-wrap break-words text-[#74c169]">
        ↳ claude
      </pre>

      <div className="mt-1 flex items-start gap-2">
        <pre className="m-0 whitespace-pre text-cc-claude">
          {LOGO_LINES.join("\n")}
        </pre>
        <pre className="m-0 whitespace-pre-wrap break-words text-cc-text">
          <span className="font-semibold text-cc-text">{CLAUDE_HEADER_TITLE}</span>
          {"\n"}
          <span className="text-cc-secondary">{CLAUDE_HEADER_SUBTITLE}</span>
          {"\n"}
          <span className="text-cc-secondary">{CLAUDE_CWD}</span>
        </pre>
      </div>
    </div>
  );
}
