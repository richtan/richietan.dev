"use client";

import type { UIMessage } from "ai";
import { Markdown } from "./markdown";
import { ToolCallBlock } from "./tool-call";

export function Message({ message }: { message: UIMessage }) {
  if (message.role === "user") {
    return <UserMessage message={message} />;
  }
  if (message.role === "assistant") {
    return <AssistantMessage message={message} />;
  }
  return null;
}

function UserMessage({ message }: { message: UIMessage }) {
  const text = message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");

  return (
    <div className="mt-4">
      <div className="flex">
        <span className="w-5 shrink-0 text-cc-secondary select-none">{">"}</span>
        <span className="text-cc-secondary whitespace-pre-wrap">{text}</span>
      </div>
    </div>
  );
}

function AssistantMessage({ message }: { message: UIMessage }) {
  return (
    <div className="mt-4">
      {message.parts.map((part, i) => {
        switch (part.type) {
          case "text":
            return (
              <div key={i} className="flex">
                <span className="w-5 shrink-0 select-none">⏺</span>
                <div className="min-w-0 flex-1">
                  <Markdown content={part.text} />
                </div>
              </div>
            );
          case "reasoning":
            return (
              <div key={i} className="mt-2 flex">
                <span className="w-5 shrink-0 text-cc-secondary select-none">
                  ✻
                </span>
                <span className="text-cc-secondary italic">
                  Thinking...
                </span>
              </div>
            );
          case "step-start":
            return null;
          default:
            if (isToolPart(part)) {
              return (
                <ToolCallBlock
                  key={i}
                  toolName={getToolName(part)}
                  state={getToolState(part)}
                  input={getToolInput(part)}
                  output={getToolOutput(part)}
                />
              );
            }
            return null;
        }
      })}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isToolPart(part: any): boolean {
  return (
    part.type === "dynamic-tool" ||
    (typeof part.type === "string" && part.type.startsWith("tool-"))
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getToolName(part: any): string {
  if (part.type === "dynamic-tool") return part.toolName;
  return part.type.replace("tool-", "");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getToolState(part: any): string {
  return part.state || "input-available";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getToolInput(part: any): unknown {
  return part.input;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getToolOutput(part: any): unknown {
  return part.output;
}
