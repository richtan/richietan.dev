"use client";

import { Markdown } from "./markdown";
import { HelpPanel } from "./help-panel";
import type { TranscriptNode } from "@/lib/transcript";

export function Message({ node }: { node: TranscriptNode }) {
  switch (node.type) {
    case "user-prompt":
      return (
        <div className="mt-2 flex items-start px-1 text-[15px] leading-6 text-cc-text">
          <span className="w-4 shrink-0 text-cc-secondary select-none">{">"}</span>
          <pre className="m-0 min-w-0 flex-1 whitespace-pre-wrap break-words">
            {node.text}
          </pre>
        </div>
      );

    case "user-command":
      return (
        <div className="mt-2 flex items-start px-1 text-[15px] leading-6 text-cc-text">
          <span className="w-4 shrink-0 text-cc-secondary select-none">{">"}</span>
          <pre className="m-0 min-w-0 flex-1 whitespace-pre-wrap break-words">
            {node.command}
          </pre>
        </div>
      );

    case "assistant-text":
      return (
        <div className="mt-3 flex items-start px-1">
          <span className="w-4 shrink-0 select-none text-cc-text">●</span>
          <div className="min-w-0 max-w-full flex-1">
            <Markdown content={node.text} />
          </div>
        </div>
      );

    case "assistant-thinking":
      return (
        <div className="mt-3 px-1">
          <div className="flex">
            <span className="w-4 shrink-0 text-cc-claude select-none">✻</span>
            <span className="text-cc-claude">Thinking...</span>
          </div>
          {node.text.trim() ? (
            <div className="pl-4 text-cc-secondary italic">
              <Markdown content={node.text} />
            </div>
          ) : null}
        </div>
      );

    case "tool-summary": {
      const dotClass =
        node.state === "running"
          ? "text-cc-claude animate-blink-dot"
          : node.state === "success"
            ? "text-cc-success"
            : "text-cc-error";

      return (
        <div className="mt-3 flex items-start px-1 text-[15px] leading-6">
          <span className={`w-4 shrink-0 select-none ${dotClass}`}>●</span>
          <div className="min-w-0 flex-1">
            <span className="font-semibold">{node.title}</span>
            {node.detail ? (
              <span className="text-cc-secondary">({node.detail})</span>
            ) : null}
            {node.state === "running" ? (
              <span className="text-cc-secondary">...</span>
            ) : null}
          </div>
        </div>
      );
    }

    case "tool-detail":
      return (
        <div className="mt-0.5 flex items-start px-1 text-[13px] leading-5">
          <span
            className={`w-5 shrink-0 select-none ${
              node.status === "success" ? "text-cc-secondary" : "text-cc-error"
            }`}
          >
            ⎿
          </span>
          <div
            className={`min-w-0 flex-1 ${
              node.status === "success" ? "text-cc-secondary" : "text-cc-error"
            }`}
          >
            {node.multiline ? (
              <pre className="whitespace-pre-wrap break-words">{node.text}</pre>
            ) : (
              node.text
            )}
          </div>
        </div>
      );

    case "tip":
      return (
        <div className="mt-0.5 pl-6 pr-1 text-[12px] leading-4 text-cc-secondary">
          {node.text}
        </div>
      );

    case "assistant-error":
      return (
        <div className="mt-1 flex items-start px-1 text-[13px] leading-5">
          <span className="w-5 shrink-0 select-none text-cc-error">⎿</span>
          <div className="min-w-0 flex-1 whitespace-pre-wrap text-cc-error">
            {node.text}
          </div>
        </div>
      );

    case "local-panel":
      return (
        <div className="mt-3">
          <HelpPanel />
        </div>
      );
  }
}
