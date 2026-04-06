"use client";

import { useEffect, useMemo } from "react";
import {
  CLAUDE_FOOTER_STATUS,
  SLASH_COMMANDS,
} from "@/lib/constants";

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
  selectedSuggestion: number;
  suggestions: ReadonlyArray<(typeof SLASH_COMMANDS)[number]>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
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
  selectedSuggestion,
  suggestions,
  textareaRef,
  historySearch,
}: InputAreaProps) {
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

  const showCaret = !disabled;
  const promptBody = input || "";
  const footerLeft = isLoading ? "esc to interrupt" : "? for shortcuts";
  const footerRight = isLoading ? "" : CLAUDE_FOOTER_STATUS;

  return (
    <div className="shrink-0">
      {historySearch.open ? (
        <pre className="mb-1 whitespace-pre-wrap break-words px-1 text-cc-secondary">
          <span className="text-cc-permission">(reverse-i-search)</span>{" "}
          <span className="text-cc-text">{historySearch.query || "_"}</span>
          {historySearch.match
            ? `: ${historySearch.match} (${historySearch.current}/${historySearch.total})`
            : ": no matches"}
        </pre>
      ) : null}

      <div
        className="relative cursor-text border-t border-b border-cc-border/90"
        onClick={() => {
          textareaRef.current?.focus({ preventScroll: true });
        }}
      >
        <div className="flex items-baseline bg-transparent px-1 py-1">
          <div className="w-4 shrink-0 select-none text-cc-text">›</div>
          <pre className="m-0 min-h-[1.2em] min-w-0 flex-1 whitespace-pre-wrap break-words text-cc-text">
            {promptBody}
            {showCaret ? <span className="select-none text-cc-text">█</span> : " "}
          </pre>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={onKeyDown}
            className="pointer-events-none absolute inset-0 h-full w-full resize-none overflow-hidden bg-transparent opacity-0 outline-none"
            rows={Math.max(1, input.split("\n").length)}
            disabled={disabled}
            spellCheck={false}
            autoComplete="off"
          />
        </div>
      </div>

      {suggestions.length > 0 ? (
        <pre className="mt-1 whitespace-pre-wrap break-words px-1">
          {suggestions.map((command, index) => {
            const selected = index === selectedSuggestion;
            const line = `  /${padRight(command.name, suggestionWidth - 1)}${command.description}`;
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
        <div className="mt-1 flex items-center justify-between px-1 text-cc-secondary/65">
          <span>{footerLeft}</span>
          {footerRight ? <span>{footerRight}</span> : <span />}
        </div>
      )}
    </div>
  );
}
