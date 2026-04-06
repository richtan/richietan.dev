"use client";

import { CLAUDE_CWD } from "@/lib/constants";

export function Welcome() {
  return (
    <div className="select-none px-1 pt-1 pb-2">
      <div className="mb-1.5 text-[12px] leading-4">
        <div className="text-[#6fd4cf]">› {CLAUDE_CWD}</div>
        <div className="text-[#7cc86c]">↳ claude</div>
      </div>

      <div className="flex items-start gap-4">
        <ClaudeGlyph />
        <div className="min-w-0 pt-0.5">
          <div className="text-[19px] leading-5 font-semibold tracking-tight text-cc-text">
            Claude Code{" "}
            <span className="font-normal text-cc-secondary">browser build</span>
          </div>
          <div className="text-[13px] leading-5 text-cc-secondary">
            Claude Sonnet 4.6 · Richie portfolio assistant
          </div>
          <div className="text-[13px] leading-5 text-cc-secondary">
            {CLAUDE_CWD}
          </div>
        </div>
      </div>
    </div>
  );
}

function ClaudeGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="h-14 w-14 shrink-0 text-cc-claude"
      viewBox="0 0 64 56"
      fill="none"
    >
      <g fill="currentColor">
        <rect x="10" y="9" width="44" height="28" rx="3" />
        <rect x="0" y="18" width="10" height="10" rx="2" />
        <rect x="54" y="18" width="10" height="10" rx="2" />
        <rect x="18" y="0" width="8" height="10" rx="2" />
        <rect x="38" y="0" width="8" height="10" rx="2" />
        <rect x="14" y="37" width="8" height="12" rx="2" />
        <rect x="28" y="37" width="8" height="12" rx="2" />
        <rect x="42" y="37" width="8" height="12" rx="2" />
      </g>
      <g fill="var(--color-cc-bg)">
        <rect x="22" y="20" width="4" height="6" rx="1" />
        <rect x="38" y="20" width="4" height="6" rx="1" />
      </g>
    </svg>
  );
}
