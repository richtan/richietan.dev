"use client";

import { WELCOME_NAME, WELCOME_ROLE } from "@/lib/constants";

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
      <div className="flex items-start gap-2">
        <Clawd />
        <div className="flex min-w-0 flex-col">
          <div
            className="min-w-0 whitespace-pre font-semibold text-cc-text"
            style={{ fontSize: "24px", lineHeight: 1 }}
          >
            {WELCOME_NAME}
          </div>
          <div className="min-w-0 whitespace-pre text-cc-secondary">
            {WELCOME_ROLE}
          </div>
        </div>
      </div>
    </div>
  );
}
