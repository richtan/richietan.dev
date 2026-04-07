"use client";

import { useEffect, useMemo } from "react";
import { CLAUDE_FOOTER_STATUS, SLASH_COMMANDS } from "@/lib/constants";
import { getPromptHelpMenuColumns } from "@/lib/terminal-shortcuts";

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
  onSelectionChange: (start: number, end: number) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  selectedSuggestion: number;
  suggestions: ReadonlyArray<(typeof SLASH_COMMANDS)[number]>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  historySearch: HistorySearchState;
  showShortcuts: boolean;
  escapeClearPending: boolean;
  selectionEnd: number;
}

function padRight(value: string, width: number) {
  return value + " ".repeat(Math.max(0, width - value.length));
}

const SLASH_COMMAND_NAME_SET: ReadonlySet<string> = new Set(
  SLASH_COMMANDS.map((command) => command.name),
);
const SLASH_COMMAND_PATTERN = /(^|[\s])(\/[a-zA-Z][a-zA-Z0-9:\-_]*)/g;

interface PromptHighlightRange {
  start: number;
  end: number;
  className: string;
}

function getPromptHighlightRanges(input: string): PromptHighlightRange[] {
  const ranges: PromptHighlightRange[] = [];
  let match: RegExpExecArray | null = null;
  SLASH_COMMAND_PATTERN.lastIndex = 0;

  while ((match = SLASH_COMMAND_PATTERN.exec(input)) !== null) {
    const precedingWhitespace = match[1] ?? "";
    const commandToken = match[2] ?? "";
    const start = match.index + precedingWhitespace.length;
    const end = start + commandToken.length;
    const commandName = commandToken.slice(1);

    if (SLASH_COMMAND_NAME_SET.has(commandName)) {
      ranges.push({
        start,
        end,
        className: "text-cc-suggestion",
      });
    }
  }

  return ranges;
}

function renderPromptSegments(
  text: string,
  startOffset: number,
  highlights: ReadonlyArray<PromptHighlightRange>,
) {
  if (!text) {
    return null;
  }

  const endOffset = startOffset + text.length;
  const overlappingHighlights = highlights.filter(
    (highlight) => highlight.end > startOffset && highlight.start < endOffset,
  );

  if (overlappingHighlights.length === 0) {
    return text;
  }

  const segments: React.ReactNode[] = [];
  let localOffset = 0;

  for (const highlight of overlappingHighlights) {
    const localStart = Math.max(0, highlight.start - startOffset);
    const localEnd = Math.min(text.length, highlight.end - startOffset);

    if (localStart > localOffset) {
      segments.push(
        <span key={`plain-${startOffset + localOffset}`}>
          {text.slice(localOffset, localStart)}
        </span>,
      );
    }

    segments.push(
      <span
        key={`highlight-${highlight.start}-${highlight.end}`}
        className={highlight.className}
      >
        {text.slice(localStart, localEnd)}
      </span>,
    );

    localOffset = localEnd;
  }

  if (localOffset < text.length) {
    segments.push(
      <span key={`plain-${startOffset + localOffset}`}>
        {text.slice(localOffset)}
      </span>,
    );
  }

  return segments;
}

function PromptBorderRow() {
  return (
    <div className="flex h-[1.2em] items-center">
      <div className="h-px w-full bg-cc-border" />
    </div>
  );
}

export function InputArea({
  disabled,
  isLoading,
  input,
  onInputChange,
  onSelectionChange,
  onKeyDown,
  selectedSuggestion,
  suggestions,
  textareaRef,
  historySearch,
  showShortcuts,
  escapeClearPending,
  selectionEnd,
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
    () => getPromptHelpMenuColumns({ supportsThinkingToggle: true }),
    [],
  );
  const shortcutRowCount = useMemo(
    () => Math.max(...shortcutColumns.map((column) => column.length)),
    [shortcutColumns],
  );

  const footerLeft = isLoading
    ? "esc to interrupt"
    : escapeClearPending
      ? "esc again to clear"
      : "? for shortcuts";
  const footerRight = isLoading ? "" : CLAUDE_FOOTER_STATUS;
  const cursorPosition = Math.max(0, Math.min(input.length, selectionEnd));
  const beforeCursor = input.slice(0, cursorPosition);
  const cursorCharacter = input[cursorPosition] ?? " ";
  const afterCursor = input.slice(Math.min(input.length, cursorPosition + 1));
  const promptHighlights = useMemo(() => getPromptHighlightRanges(input), [input]);

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
        className="relative cursor-text bg-transparent"
        onPointerDown={(event) => {
          event.preventDefault();
          textareaRef.current?.focus({ preventScroll: true });
        }}
      >
        <PromptBorderRow />
        <div className="flex min-h-[1.2em] items-start px-2">
          <span className="w-[2ch] shrink-0 select-none whitespace-pre text-cc-text">
            ❯{" "}
          </span>
          <div className="min-w-0 flex-1 whitespace-pre-wrap break-words text-cc-text">
            {disabled ? (
              <>
                {renderPromptSegments(input, 0, promptHighlights)}
                {input.length === 0 ? " " : null}
              </>
            ) : (
              <>
                {renderPromptSegments(beforeCursor, 0, promptHighlights)}
                <span className="select-none bg-cc-text text-cc-bg">
                  {cursorCharacter === " " ? "\u00A0" : cursorCharacter}
                </span>
                {renderPromptSegments(
                  afterCursor,
                  Math.min(input.length, cursorPosition + 1),
                  promptHighlights,
                )}
              </>
            )}
          </div>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => {
              onInputChange(event.target.value);
              onSelectionChange(
                event.target.selectionStart,
                event.target.selectionEnd,
              );
            }}
            onSelect={(event) => {
              onSelectionChange(
                event.currentTarget.selectionStart,
                event.currentTarget.selectionEnd,
              );
            }}
            onKeyDown={onKeyDown}
            className="pointer-events-none absolute inset-0 h-full w-full resize-none overflow-hidden bg-transparent opacity-0 outline-none"
            rows={Math.max(1, input.split("\n").length)}
            disabled={disabled}
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        <PromptBorderRow />
      </div>

      {showShortcuts && suggestions.length === 0 ? (
        <div className="grid grid-cols-[24ch_35ch_1fr] gap-x-2 px-2 text-cc-secondary">
          {shortcutColumns.map((column, columnIndex) => (
            <div key={`shortcut-col-${columnIndex}`} className="min-w-0">
              {Array.from({ length: shortcutRowCount }, (_, rowIndex) => (
                <div key={`shortcut-${columnIndex}-${rowIndex}`}>
                  {column[rowIndex] || "\u00A0"}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : suggestions.length > 0 ? (
        <div className="px-2">
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
        <div
          className="flex h-[1.2em] items-center justify-between text-cc-secondary"
          style={{
            paddingLeft: "calc(0.5rem + 2ch)",
            paddingRight: "0.95rem",
          }}
        >
          <span>{footerLeft}</span>
          {footerRight ? <span>{footerRight}</span> : <span />}
        </div>
      )}
    </div>
  );
}
