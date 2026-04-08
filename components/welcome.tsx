"use client";

import {
  CLAUDE_DISPLAY_CWD,
  CLAUDE_HEADER_SUBTITLE,
  CLAUDE_HEADER_TITLE,
} from "@/lib/constants";

function Clawd() {
  return (
    <div className="flex flex-col leading-none text-cc-claude">
      <div className="whitespace-pre">
        <span> ▐</span>
        <span className="bg-black">▛███▜</span>
        <span>▌</span>
      </div>
      <div className="whitespace-pre">
        <span>▝▜</span>
        <span className="bg-black">█████</span>
        <span>▛▘</span>
      </div>
      <div className="whitespace-pre">{"  "}▘▘ ▝▝{"  "}</div>
    </div>
  );
}

export function Welcome() {
  return (
    <div className="select-none px-2 pt-1">
      <div className="flex items-center gap-2">
        <Clawd />
        <div className="flex min-w-0 flex-col">
          <div className="min-w-0 whitespace-pre">
            <span className="font-semibold text-cc-text">
              {CLAUDE_HEADER_TITLE.replace(/ v.+$/, "")}
            </span>
            <span className="text-cc-secondary">
              {" "}
              {CLAUDE_HEADER_TITLE.replace(/^Claude Code /, "")}
            </span>
          </div>
          <div className="min-w-0 whitespace-pre text-cc-secondary">
            {CLAUDE_HEADER_SUBTITLE}
          </div>
          <div className="min-w-0 whitespace-pre text-cc-secondary">
            {CLAUDE_DISPLAY_CWD}
          </div>
        </div>
      </div>
    </div>
  );
}
