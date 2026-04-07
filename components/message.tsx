"use client";

import { Markdown } from "./markdown";
import { HelpPanel } from "./help-panel";
import type { TranscriptNode } from "@/lib/transcript";

const TRANSCRIPT_ROW_GAP = "mt-[1.2em]";
const TRANSCRIPT_CONTINUATION = "mt-0";
const USER_ROW =
  "flex w-full items-start bg-cc-user-message pr-[1ch] text-cc-text";

function UserRow({ text }: { text: string }) {
  return (
    <div className={`${TRANSCRIPT_ROW_GAP} px-2`}>
      <div className={USER_ROW}>
        <span className="w-4 shrink-0 select-none text-cc-secondary opacity-[0.5]">
          ❯
        </span>
        <pre className="m-0 min-w-0 flex-1 whitespace-pre-wrap break-words">
          {text}
        </pre>
      </div>
    </div>
  );
}

export function Message({
  node,
  streaming = false,
}: {
  node: TranscriptNode;
  streaming?: boolean;
}) {
  switch (node.type) {
    case "user-prompt":
      return <UserRow text={node.text} />;

    case "user-command":
      return <UserRow text={node.command} />;

    case "assistant-text":
      return (
        <div className={`${TRANSCRIPT_ROW_GAP} flex items-start px-2`}>
          <span className="w-4 shrink-0 select-none text-cc-text">●</span>
          <div className="min-w-0 max-w-full flex-1">
            <Markdown content={node.text} streaming={streaming} />
          </div>
        </div>
      );

    case "assistant-thinking":
      return (
        <div className={`${TRANSCRIPT_ROW_GAP} px-2`}>
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
        <div className={`${TRANSCRIPT_ROW_GAP} flex items-baseline px-2`}>
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
        <div className={`${TRANSCRIPT_CONTINUATION} flex items-baseline px-2`}>
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
        <div className={`${TRANSCRIPT_CONTINUATION} pl-6 pr-2 text-cc-secondary`}>
          {node.text}
        </div>
      );

    case "assistant-error":
      return (
        <div className={`${TRANSCRIPT_CONTINUATION} flex items-baseline px-2`}>
          <span className="w-4 shrink-0 select-none text-cc-error">⎿</span>
          <div className="min-w-0 flex-1 whitespace-pre-wrap text-cc-error">
            {node.text}
          </div>
        </div>
      );

    case "system-note":
      return (
        <div className={`${TRANSCRIPT_CONTINUATION} flex items-baseline px-2`}>
          <span className="w-4 shrink-0 select-none text-cc-secondary">⎿</span>
          <div className="min-w-0 flex-1 whitespace-pre-wrap text-cc-text">
            {node.text}
          </div>
        </div>
      );

    case "local-panel":
      return (
        <div className={TRANSCRIPT_ROW_GAP}>
          <HelpPanel />
        </div>
      );
  }
}
