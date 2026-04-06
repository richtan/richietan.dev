"use client";

import { useEffect, useMemo, useState } from "react";
import { SLASH_COMMANDS } from "@/lib/constants";

interface HistorySearchState {
  open: boolean;
  query: string;
  match: string | null;
  current: number;
  total: number;
}

interface InputAreaProps {
  disabled: boolean;
  isLoading: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  selectedSuggestion: number;
  suggestions: ReadonlyArray<(typeof SLASH_COMMANDS)[number]>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  extendedThinking: boolean;
  verboseOutput: boolean;
  historySearch: HistorySearchState;
}

function padRight(value: string, width: number) {
  return value + " ".repeat(Math.max(0, width - value.length));
}

export function InputArea({
  disabled,
  isLoading,
  input,
  onInputChange,
  onKeyDown,
  placeholder,
  selectedSuggestion,
  suggestions,
  textareaRef,
  extendedThinking,
  verboseOutput,
  historySearch,
}: InputAreaProps) {
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!disabled) {
      textareaRef.current?.focus();
    }
  }, [disabled, textareaRef]);

  const suggestionWidth = useMemo(() => {
    const names = suggestions.map((command) => `/${command.name}`);
    const maxWidth = names.reduce(
      (width, name) => Math.max(width, name.length),
      12,
    );
    return maxWidth + 2;
  }, [suggestions]);

  const promptBody = input || "";
  const showPlaceholder = input.length === 0;
  const showCaret = isFocused && !disabled && !isLoading;
  const footerText = isLoading
    ? "esc to interrupt"
    : `? for shortcuts · / for commands · thinking ${extendedThinking ? "on" : "off"} · verbose ${verboseOutput ? "on" : "off"}`;

  return (
    <div className="mt-2 px-1">
      {historySearch.open ? (
        <pre className="mb-1.5 whitespace-pre-wrap break-words text-[13px] leading-5 text-cc-secondary">
          <span className="text-cc-permission">(reverse-i-search)</span>{" "}
          <span className="text-cc-text">{historySearch.query || "_"}</span>
          {historySearch.match
            ? `: ${historySearch.match} (${historySearch.current}/${historySearch.total})`
            : ": no matches"}
        </pre>
      ) : null}

      <div
        className="relative cursor-text"
        onMouseDown={(event) => {
          if (event.target !== textareaRef.current) {
            event.preventDefault();
            textareaRef.current?.focus();
          }
        }}
      >
        <div className="flex items-start text-[15px] leading-6">
          <div className="w-4 shrink-0 text-cc-secondary">{">"}</div>
          <pre className="m-0 min-h-[24px] min-w-0 flex-1 whitespace-pre-wrap break-words text-cc-text">
            {showPlaceholder ? (
              <span className="text-cc-secondary/55">{placeholder}</span>
            ) : (
              promptBody || " "
            )}
            {showCaret ? <span className="animate-caret-pulse">█</span> : null}
          </pre>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className="absolute inset-0 h-full w-full resize-none overflow-hidden bg-transparent opacity-0 outline-none"
            rows={Math.max(1, input.split("\n").length)}
            disabled={disabled}
            spellCheck={false}
            autoComplete="off"
          />
        </div>
      </div>

      {suggestions.length > 0 ? (
        <pre className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-5">
          {suggestions.map((command, index) => {
            const selected = index === selectedSuggestion;
            const line = `${padRight(`/${command.name}`, suggestionWidth)}${command.description}`;
            return (
              <span
                key={command.name}
                className={selected ? "text-cc-suggestion" : "text-cc-secondary/60"}
              >
                {line}
                {"\n"}
              </span>
            );
          })}
        </pre>
      ) : (
        <pre className="mt-1 whitespace-pre-wrap break-words text-[12px] leading-4 text-cc-secondary/70">
          {footerText}
        </pre>
      )}
    </div>
  );
}
