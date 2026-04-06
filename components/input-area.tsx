"use client";

import { useEffect } from "react";
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
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [input, textareaRef]);

  useEffect(() => {
    if (!disabled) {
      textareaRef.current?.focus();
    }
  }, [disabled, textareaRef]);

  return (
    <div className="mt-2">
      {historySearch.open ? (
        <div className="mb-2 px-1 text-[13px] leading-5 text-cc-secondary">
          <span className="text-cc-permission">(reverse-i-search)</span>{" "}
          <span className="text-cc-text">{historySearch.query || "_"}</span>
          {historySearch.match ? (
            <>
              {": "}
              <span className="text-cc-text">{historySearch.match}</span>
              <span className="text-cc-secondary/70">
                {" "}
                ({historySearch.current}/{historySearch.total})
              </span>
            </>
          ) : (
            <span className="text-cc-error">: no matches</span>
          )}
        </div>
      ) : null}

      <div className="border-y border-cc-border/85">
        <div className="flex items-start bg-cc-rail/95">
          <div className="flex min-h-[36px] w-6 shrink-0 items-center justify-center text-cc-secondary">
            {">"}
          </div>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="min-h-[36px] max-h-[280px] flex-1 resize-none bg-transparent py-[5px] pr-2 text-[15px] leading-6 text-cc-text outline-none placeholder:text-cc-secondary/55"
            rows={1}
            disabled={disabled}
            spellCheck={false}
            autoComplete="off"
          />
        </div>
      </div>

      {suggestions.length > 0 ? (
        <div className="px-1 pt-2">
          <div className="space-y-0.5 text-[13px] leading-5">
            {suggestions.map((command, index) => {
              const selected = index === selectedSuggestion;
              return (
                <div
                  key={command.name}
                  className={`grid gap-3 md:grid-cols-[minmax(0,14rem)_1fr] ${
                    selected ? "text-cc-suggestion" : "text-cc-secondary/55"
                  }`}
                >
                  <div>
                    /{command.name}
                  </div>
                  <div>{command.description}</div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1 px-1 pt-2 text-[12px] leading-4 text-cc-secondary/70 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {isLoading ? (
              <span>esc to interrupt</span>
            ) : (
              <span>? for shortcuts</span>
            )}
          </div>
          {!isLoading ? (
            <div>
              <span>/ for commands</span>
              <span> · thinking {extendedThinking ? "on" : "off"}</span>
              <span> · verbose {verboseOutput ? "on" : "off"}</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
