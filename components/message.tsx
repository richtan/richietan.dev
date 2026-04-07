"use client";

import { Markdown } from "./markdown";
import { HelpPanel } from "./help-panel";
import type { TranscriptNode } from "@/lib/transcript";

export function Message({
  node,
  streaming = false,
}: {
  node: TranscriptNode;
  streaming?: boolean;
}) {
  switch (node.type) {
    case "user-prompt":
      return (
        <div className="mt-1 bg-cc-user-message px-2 text-cc-text">
          <div className="flex items-start py-1">
            <span className="w-4 shrink-0 select-none text-cc-secondary">❯</span>
            <pre className="m-0 min-w-0 flex-1 whitespace-pre-wrap break-words">
              {node.text}
            </pre>
          </div>
        </div>
      );

    case "user-command":
      return (
        <div className="mt-1 bg-cc-user-message px-2 text-cc-text">
          <div className="flex items-start py-1">
            <span className="w-4 shrink-0 select-none text-cc-secondary">❯</span>
            <pre className="m-0 min-w-0 flex-1 whitespace-pre-wrap break-words">
              {node.command}
            </pre>
          </div>
        </div>
      );

    case "assistant-text":
      return (
        <div className="mt-2 flex items-start px-2">
          <span className="w-4 shrink-0 select-none text-cc-text">●</span>
          <div className="min-w-0 max-w-full flex-1">
            <Markdown content={node.text} streaming={streaming} />
          </div>
        </div>
      );

    case "assistant-thinking":
      return (
        <div className="mt-2 px-2">
          <div className="flex items-baseline">
            <span className="w-4 shrink-0 text-cc-claude select-none">✻</span>
            <span className="text-cc-claude">Thinking...</span>
          </div>
          {node.text.trim() ? (
            <pre className="m-0 whitespace-pre-wrap break-words pl-4 text-cc-secondary italic">
              {node.text}
            </pre>
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
        <div className="mt-2 flex items-baseline px-2">
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
        <div className="mt-0 flex items-baseline px-2">
          <span
            className={`w-4 shrink-0 select-none ${
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
              <pre className="m-0 whitespace-pre-wrap break-words">{node.text}</pre>
            ) : (
              node.text
            )}
          </div>
        </div>
      );

    case "tip":
      return (
        <div className="mt-0 pl-6 pr-2 text-cc-secondary">
          {node.text}
        </div>
      );

    case "assistant-error":
      return (
        <div className="mt-0 flex items-baseline px-2">
          <span className="w-4 shrink-0 select-none text-cc-error">⎿</span>
          <div className="min-w-0 flex-1 whitespace-pre-wrap text-cc-error">
            {node.text}
          </div>
        </div>
      );

    case "system-note":
      return (
        <div className="mt-0 flex items-baseline px-2">
          <span className="w-4 shrink-0 select-none text-cc-secondary">⎿</span>
          <div className="min-w-0 flex-1 whitespace-pre-wrap text-cc-text">
            {node.text}
          </div>
        </div>
      );

    case "local-panel":
      return (
        <div className="mt-2">
          <HelpPanel />
        </div>
      );
  }
}
