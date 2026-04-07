"use client";

import { useEffect, useMemo } from "react";
import { CLAUDE_FOOTER_STATUS, SLASH_COMMANDS } from "@/lib/constants";

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
  showShortcuts: boolean;
}

const SHORTCUT_ROWS = [
  ["! for bash mode", "double tap esc to clear input", "ctrl + shift + - to undo"],
  ["/ for commands", "shift + tab to auto-accept edits", "ctrl + z to suspend"],
  ["@ for file paths", "ctrl + o for verbose output", "ctrl + v to paste images"],
  ["& for background", "ctrl + t to toggle tasks", "meta + p to switch model"],
  ["/btw for side question", "shift + ↵ for newline", "meta + o to toggle fast mode"],
  ["", "", "ctrl + s to stash prompt"],
  ["", "", "ctrl + g to edit in $EDITOR"],
  ["", "", "/keybindings to customize"],
] as const;

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
  showShortcuts,
}: InputAreaProps) {
  useEffect(() => {
    if (!disabled) {
      textareaRef.current?.focus();
    }
  }, [disabled, textareaRef]);

  const suggestionWidth = useMemo(() => {
    return Math.max(
      18,
      ...suggestions.map((command) => `/${command.name}`.length + 2),
    );
  }, [suggestions]);

  const shortcutColumns = useMemo(
    () =>
      SHORTCUT_ROWS[0].map((_, columnIndex) =>
        SHORTCUT_ROWS.reduce(
          (width, row) => Math.max(width, row[columnIndex]?.length ?? 0),
          0,
        ),
      ),
    [],
  );

  const footerLeft = isLoading ? "esc to interrupt" : "? for shortcuts";
  const footerRight = isLoading ? "" : CLAUDE_FOOTER_STATUS;

  return (
    <div className="shrink-0">
      {historySearch.open ? (
        <div className="mb-1 px-2 text-cc-secondary">
          <span className="text-cc-permission">(reverse-i-search)</span>{" "}
          <span className="text-cc-text">{historySearch.query || "_"}</span>
          {historySearch.match
            ? `: ${historySearch.match} (${historySearch.current}/${historySearch.total})`
            : ": no matches"}
        </div>
      ) : null}

      <div
        className="relative cursor-text border-t border-b border-cc-border bg-transparent"
        onPointerDown={(event) => {
          event.preventDefault();
          textareaRef.current?.focus({ preventScroll: true });
        }}
      >
        <div className="flex items-start px-2 py-1">
          <span className="w-4 shrink-0 select-none text-cc-text">❯</span>
          <div className="min-w-0 flex-1 whitespace-pre-wrap break-words text-cc-text">
            {input}
            {!disabled ? <span className="select-none text-cc-text">█</span> : " "}
          </div>
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

      {showShortcuts && suggestions.length === 0 ? (
        <div className="mt-1 grid grid-cols-[24ch_35ch_1fr] gap-x-2 px-2 text-cc-secondary">
          {shortcutColumns.map((_, columnIndex) => (
            <div key={`shortcut-col-${columnIndex}`} className="min-w-0">
              {SHORTCUT_ROWS.map((row, rowIndex) => (
                <div key={`shortcut-${columnIndex}-${rowIndex}`}>
                  {row[columnIndex] || "\u00A0"}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : suggestions.length > 0 ? (
        <div className="mt-1 px-2">
          {suggestions.map((command, index) => {
            const selected = index === selectedSuggestion;
            const name = `/${command.name}`;
            return (
              <div
                key={command.name}
                className={`flex min-w-0 ${
                  selected ? "text-cc-suggestion" : "text-cc-secondary"
                }`}
              >
                <span className="shrink-0 whitespace-pre">
                  {padRight(name, suggestionWidth)}
                </span>
                <span className={selected ? "text-cc-suggestion" : "text-cc-secondary/80"}>
                  {command.description}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-1 flex items-center justify-between px-2 text-cc-secondary">
          <span>{footerLeft}</span>
          {footerRight ? <span>{footerRight}</span> : <span />}
        </div>
      )}
    </div>
  );
}
