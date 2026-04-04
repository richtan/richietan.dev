"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { SlashMenu } from "./slash-menu";
import { SLASH_COMMANDS } from "@/lib/constants";

interface InputAreaProps {
  onSend: (text: string) => void;
  onClear: () => void;
  disabled: boolean;
}

export function InputArea({ onSend, onClear, disabled }: InputAreaProps) {
  const [input, setInput] = useState("");
  const [showSlash, setShowSlash] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [slashIndex, setSlashIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [input]);

  // Auto-focus when not disabled
  useEffect(() => {
    if (!disabled) textareaRef.current?.focus();
  }, [disabled]);

  const handleChange = useCallback((value: string) => {
    setInput(value);
    if (value.startsWith("/")) {
      setShowSlash(true);
      setSlashFilter(value);
      setSlashIndex(0);
    } else {
      setShowSlash(false);
    }
  }, []);

  const handleSlashSelect = useCallback(
    (command: string) => {
      setShowSlash(false);
      setInput("");
      if (command === "/clear") {
        onClear();
        return;
      }
      if (command === "/help") {
        onSend("/help");
        return;
      }
      onSend(command.slice(1));
    },
    [onSend, onClear],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSlash) {
      const filtered = SLASH_COMMANDS.filter((cmd) =>
        cmd.name.startsWith(slashFilter.toLowerCase()),
      );
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIndex((i) => Math.min(i + 1, filtered.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && filtered.length > 0)) {
        e.preventDefault();
        if (filtered[slashIndex]) {
          handleSlashSelect(filtered[slashIndex].name);
        }
        return;
      }
      if (e.key === "Escape") {
        setShowSlash(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || disabled) return;
      onSend(trimmed);
      setInput("");
    }
  };

  const placeholders = [
    'Try "tell me about Richie"',
    'Try "what are your skills?"',
    'Try "show me your projects"',
    'Try "how can I contact you?"',
  ];
  const [placeholder, setPlaceholder] = useState(placeholders[0]);
  useEffect(() => {
    setPlaceholder(
      placeholders[Math.floor(Math.random() * placeholders.length)],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mt-4 px-2">
      {/* Input box with rounded border */}
      <div
        className={`rounded-lg border ${disabled ? "border-cc-border/30" : "border-cc-border/50"} px-1 py-1`}
      >
        <div className="flex items-start">
          <span
            className={`shrink-0 px-2 py-0.5 select-none ${disabled ? "text-cc-secondary/50" : "text-cc-secondary"}`}
          >
            {">"}
          </span>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="max-h-[200px] min-h-[24px] flex-1 resize-none bg-transparent py-0.5 text-white outline-none placeholder:text-cc-secondary/40"
            rows={1}
            disabled={disabled}
            spellCheck={false}
            autoComplete="off"
          />
        </div>
      </div>

      {/* Hints or slash menu below input */}
      {showSlash ? (
        <SlashMenu
          filter={slashFilter}
          selectedIndex={slashIndex}
          onSelect={handleSlashSelect}
        />
      ) : (
        <div className="flex justify-between px-2 pt-1 text-xs text-cc-secondary/40">
          <span>
            / for commands
          </span>
          <span>shift + ⏎ for newline</span>
        </div>
      )}
    </div>
  );
}
