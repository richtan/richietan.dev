"use client";

import {
  CLAUDE_CWD,
  CLAUDE_HEADER_SUBTITLE,
  CLAUDE_HEADER_TITLE,
} from "@/lib/constants";

const HEADER_LINES = [
  {
    mark: " ▐▛███▜▌",
    spacing: "   ",
    text: CLAUDE_HEADER_TITLE,
    muted: false,
  },
  {
    mark: "▝▜█████▛▘",
    spacing: "  ",
    text: CLAUDE_HEADER_SUBTITLE,
    muted: true,
  },
  {
    mark: "  ▘▘ ▝▝",
    spacing: "    ",
    text: CLAUDE_CWD,
    muted: true,
  },
] as const;

export function Welcome() {
  return (
    <div className="select-none px-1 pt-1 pb-2">
      <pre className="m-0 whitespace-pre">
        <span className="text-[#74c169]">➜</span>
        <span className="text-cc-text"> claude</span>
      </pre>

      <pre className="mt-1 m-0 whitespace-pre text-cc-text">
        {HEADER_LINES.map((line, index) => (
          <span key={line.text}>
            <span className="text-cc-claude">{line.mark}</span>
            <span className={line.muted ? "text-cc-secondary" : "font-semibold text-cc-text"}>
              {line.spacing}
              {line.text}
            </span>
            {index < HEADER_LINES.length - 1 ? "\n" : null}
          </span>
        ))}
      </pre>
    </div>
  );
}
