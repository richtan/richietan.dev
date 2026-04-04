"use client";

import { useState } from "react";

interface ToolCallProps {
  toolName: string;
  state: string;
  input?: unknown;
  output?: unknown;
}

export function ToolCallBlock({ toolName, state, input, output }: ToolCallProps) {
  const [expanded, setExpanded] = useState(false);

  const displayName = toolName
    .replace(/^get_/, "")
    .replace(/_/g, " ");

  // Format params for display
  const paramStr =
    input && typeof input === "object" && Object.keys(input).length > 0
      ? Object.entries(input)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ")
      : "";

  const isRunning = state === "input-streaming" || state === "input-available";
  const hasOutput = state === "output-available";
  const hasError = state === "output-error";

  // Dot color based on state
  const dotColor = isRunning
    ? "text-cc-secondary animate-blink-dot"
    : hasError
      ? "text-cc-error"
      : hasOutput
        ? "text-cc-success"
        : "text-cc-secondary";

  return (
    <div className="mt-2">
      {/* Tool call header */}
      <div className="flex pl-2">
        <span className={`w-5 shrink-0 select-none ${dotColor}`}>⏺</span>
        <span>
          <span className={`font-bold ${isRunning ? "" : ""}`}>
            {displayName}
          </span>
          {paramStr && (
            <span className="text-cc-secondary">({paramStr})</span>
          )}
          {isRunning && <span className="text-cc-secondary">...</span>}
        </span>
      </div>

      {/* Tool result */}
      {hasOutput && output != null && (
        <div className="mt-0.5 pl-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex cursor-pointer text-cc-secondary hover:text-white"
          >
            <span className="w-5 shrink-0 select-none">⎿</span>
            <span className="text-sm">
              {expanded ? "(collapse)" : "(expand result)"}
            </span>
          </button>
          {expanded && (
            <div className="mt-1 pl-5 text-sm text-cc-secondary">
              <pre className="whitespace-pre-wrap">
                {typeof output === "string"
                  ? output
                  : JSON.stringify(output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Error result */}
      {hasError && (
        <div className="mt-0.5 flex pl-2">
          <span className="w-5 shrink-0 select-none text-cc-error">⎿</span>
          <span className="text-cc-error text-sm">
            {typeof output === "string" ? output : "Tool execution failed"}
          </span>
        </div>
      )}
    </div>
  );
}
