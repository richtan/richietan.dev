"use client";

import { useChat } from "@ai-sdk/react";
import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import { hackNerdMono } from "@/app/fonts";
import { Welcome } from "./welcome";
import { Message } from "./message";
import { InputArea } from "./input-area";
import { CLAUDE_CWD, getSlashCommand, SLASH_COMMANDS } from "@/lib/constants";
import {
  AppMessage,
  createAssistantPanelMessage,
  createAssistantTextMessage,
  createUserTextMessage,
  normalizeMessages,
  type TranscriptNode,
} from "@/lib/transcript";

const SPINNER_CHARS = ["·", "✢", "✳", "∗", "✻", "✽"];
const SPINNER_SEQUENCE = [...SPINNER_CHARS, ...[...SPINNER_CHARS].reverse()];
const AUTO_SCROLL_THRESHOLD = 32;
const SPINNER_MESSAGES = [
  "Accomplishing",
  "Actioning",
  "Actualizing",
  "Baking",
  "Brewing",
  "Calculating",
  "Cerebrating",
  "Churning",
  "Clauding",
  "Coalescing",
  "Cogitating",
  "Computing",
  "Conjuring",
  "Considering",
  "Cooking",
  "Crafting",
  "Creating",
  "Crunching",
  "Deliberating",
  "Determining",
  "Doing",
  "Effecting",
  "Finagling",
  "Forging",
  "Forming",
  "Generating",
  "Hatching",
  "Herding",
  "Honking",
  "Hustling",
  "Ideating",
  "Inferring",
  "Manifesting",
  "Marinating",
  "Moseying",
  "Mulling",
  "Mustering",
  "Musing",
  "Noodling",
  "Percolating",
  "Pondering",
  "Processing",
  "Puttering",
  "Reticulating",
  "Ruminating",
  "Schlepping",
  "Shucking",
  "Simmering",
  "Smooshing",
  "Spinning",
  "Stewing",
  "Synthesizing",
  "Thinking",
  "Transmuting",
  "Vibing",
  "Working",
];

const HISTORY_KEY = `richietan.dev::claude-code::history::${CLAUDE_CWD}`;

function getStoredHistory() {
  if (typeof window === "undefined") {
    return [] as string[];
  }

  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (!stored) {
      return [] as string[];
    }

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [] as string[];
  }
}

function setCursorPosition(
  textarea: HTMLTextAreaElement | null,
  position: number,
) {
  if (!textarea) {
    return;
  }

  requestAnimationFrame(() => {
    textarea.selectionStart = position;
    textarea.selectionEnd = position;
  });
}

function replaceSelection(
  textarea: HTMLTextAreaElement | null,
  value: string,
  setInput: (value: string) => void,
  replacement: string,
  removePreviousChar = false,
) {
  if (!textarea) {
    return;
  }

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const safeStart = removePreviousChar ? Math.max(0, start - 1) : start;
  const nextValue = `${value.slice(0, safeStart)}${replacement}${value.slice(end)}`;
  const nextCursor = safeStart + replacement.length;
  setInput(nextValue);
  setCursorPosition(textarea, nextCursor);
}

function getHistoryMatches(history: string[], query: string) {
  if (!query) {
    return [...history].reverse();
  }

  return history
    .filter((entry) => entry.toLowerCase().includes(query.toLowerCase()))
    .reverse();
}

function isCaretOnFirstLine(textarea: HTMLTextAreaElement | null, value: string) {
  if (!textarea) {
    return true;
  }
  return !value.slice(0, textarea.selectionStart).includes("\n");
}

function isCaretOnLastLine(textarea: HTMLTextAreaElement | null, value: string) {
  if (!textarea) {
    return true;
  }
  return !value.slice(textarea.selectionEnd).includes("\n");
}

function createLocalError(text: string) {
  return createAssistantTextMessage(text, { localError: true });
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement
    ? target.closest(
        [
          "a",
          "button",
          "input",
          "textarea",
          "select",
          "option",
          "label",
          "summary",
          "[role='button']",
          "[role='link']",
          "[contenteditable='true']",
          "[data-terminal-interactive='true']",
        ].join(","),
      ) !== null
    : false;
}

export function Terminal() {
  const {
    messages,
    status,
    error,
    sendMessage,
    setMessages,
    stop,
    clearError,
  } = useChat<AppMessage>({
    experimental_throttle: 16,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [extendedThinking, setExtendedThinking] = useState(false);
  const [verboseOutput, setVerboseOutput] = useState(false);
  const [screenStartIndex, setScreenStartIndex] = useState(0);
  const [history, setHistory] = useState<string[]>(getStoredHistory);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [historyDraft, setHistoryDraft] = useState("");
  const [historySearchOpen, setHistorySearchOpen] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [historySearchIndex, setHistorySearchIndex] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const [spinnerElapsed, setSpinnerElapsed] = useState(0);
  const [spinnerMessageIndex, setSpinnerMessageIndex] = useState(0);
  const followOutputRef = useRef(true);
  const touchYRef = useRef<number | null>(null);

  const visibleMessages = useDeferredValue(messages.slice(screenStartIndex));
  const transcript = normalizeMessages(visibleMessages, { verboseOutput });
  const suggestions = input.startsWith("/")
    ? SLASH_COMMANDS.filter((command) =>
        command.name.startsWith(input.slice(1).toLowerCase()),
      )
    : [];
  const historyMatches = getHistoryMatches(history, historySearchQuery);
  const activeHistoryMatch = historyMatches[historySearchIndex] ?? null;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-100)));
  }, [history]);

  function scrollToBottom(behavior: ScrollBehavior = "auto") {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    el.scrollTo({
      top: el.scrollHeight,
      behavior,
    });
  }

  useEffect(() => {
    if (!followOutputRef.current) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      scrollToBottom(status === "streaming" ? "auto" : "smooth");
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [transcript, status, error]);

  useEffect(() => {
    if (status !== "submitted" && status !== "streaming") {
      return;
    }

    const frameTimer = setInterval(() => {
      setSpinnerFrame((frame) => (frame + 1) % SPINNER_SEQUENCE.length);
    }, 120);

    const elapsedTimer = setInterval(() => {
      setSpinnerElapsed((value) => value + 1);
    }, 1000);

    return () => {
      clearInterval(frameTimer);
      clearInterval(elapsedTimer);
    };
  }, [status]);

  function isNearBottom(el: HTMLDivElement) {
    return el.scrollHeight - el.scrollTop - el.clientHeight <= AUTO_SCROLL_THRESHOLD;
  }

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    followOutputRef.current = isNearBottom(el);
  }

  function handleWheelCapture(event: React.WheelEvent<HTMLDivElement>) {
    if (event.deltaY < 0) {
      followOutputRef.current = false;
    }
  }

  function handleTouchStartCapture(event: React.TouchEvent<HTMLDivElement>) {
    touchYRef.current = event.touches[0]?.clientY ?? null;
  }

  function handleTouchMoveCapture(event: React.TouchEvent<HTMLDivElement>) {
    const nextY = event.touches[0]?.clientY;
    if (nextY === undefined) {
      return;
    }

    if (touchYRef.current !== null && nextY > touchYRef.current) {
      followOutputRef.current = false;
    }

    touchYRef.current = nextY;
  }

  function focusPrompt() {
    textareaRef.current?.focus({ preventScroll: true });
  }

  function handleTerminalClick(event: React.MouseEvent<HTMLDivElement>) {
    if (isInteractiveTarget(event.target)) {
      return;
    }

    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      return;
    }

    focusPrompt();
  }

  function pushHistoryEntry(value: string) {
    setHistory((current) => {
      const next = current.filter((entry) => entry !== value);
      next.push(value);
      return next.slice(-100);
    });
    setHistoryIndex(null);
    setHistoryDraft("");
  }

  function appendLocalMessages(nextMessages: AppMessage[]) {
    startTransition(() => {
      setMessages((current) => [...current, ...nextMessages]);
    });
  }

  async function submitText(value: string) {
    const trimmed = value.trim();
    if (!trimmed || status === "submitted" || status === "streaming") {
      return;
    }

    setSpinnerElapsed(0);
    setSpinnerFrame(0);
    setSpinnerMessageIndex((index) => (index + 1) % SPINNER_MESSAGES.length);
    clearError();
    followOutputRef.current = true;
    scrollToBottom("auto");
    setInput("");
    setShowShortcuts(false);
    setSelectedSuggestion(0);
    setHistorySearchOpen(false);
    setHistorySearchQuery("");
    setHistorySearchIndex(0);
    pushHistoryEntry(trimmed);

    if (trimmed === "?") {
      setShowShortcuts((current) => !current);
      return;
    }

    if (trimmed.startsWith("/")) {
      const [name] = trimmed.slice(1).split(/\s+/, 1);
      const command = getSlashCommand(name ?? "");

      if (!command) {
        appendLocalMessages([
          createUserTextMessage(trimmed),
          createLocalError(`Unknown command: ${trimmed}`),
        ]);
        return;
      }

      if (command.kind === "local") {
        if (command.name === "clear") {
          await clearConversation();
          return;
        }

        if (command.name === "help") {
          appendLocalMessages([
            createUserTextMessage(trimmed),
            createAssistantPanelMessage("help"),
          ]);
          return;
        }
      }

      await sendMessage(
        { text: trimmed },
        {
          body: {
            extendedThinking,
            verboseOutput,
            commandContext: {
              source: "slash",
              commandName: command.name,
            },
          },
        },
      );
      return;
    }

    await sendMessage(
      { text: trimmed },
      {
        body: {
          extendedThinking,
          verboseOutput,
          commandContext: {
            source: "prompt",
          },
        },
      },
    );
  }

  async function clearConversation() {
    clearError();
    followOutputRef.current = true;
    setInput("");
    setHistory([]);
    setHistoryIndex(null);
    setHistoryDraft("");
    setScreenStartIndex(0);
    startTransition(() => {
      setMessages([]);
    });
    if (typeof window !== "undefined") {
      localStorage.removeItem(HISTORY_KEY);
    }
  }

  async function submitCurrentInput() {
    await submitText(input);
  }

  async function handleSubmitSuggestion() {
    const suggestion = suggestions[selectedSuggestion];
    if (!suggestion) {
      return;
    }

    const nextValue = `/${suggestion.name}`;
    await submitText(nextValue);
  }

  function navigateHistory(direction: "up" | "down") {
    if (history.length === 0) {
      return;
    }

    if (historyIndex === null) {
      if (direction === "down") {
        return;
      }
      setHistoryDraft(input);
      const nextIndex = history.length - 1;
      setHistoryIndex(nextIndex);
      setInput(history[nextIndex] ?? "");
      setCursorPosition(textareaRef.current, (history[nextIndex] ?? "").length);
      return;
    }

    if (direction === "up") {
      const nextIndex = Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setInput(history[nextIndex] ?? "");
      setCursorPosition(textareaRef.current, (history[nextIndex] ?? "").length);
      return;
    }

    const nextIndex = historyIndex + 1;
    if (nextIndex >= history.length) {
      setHistoryIndex(null);
      setInput(historyDraft);
      setCursorPosition(textareaRef.current, historyDraft.length);
      return;
    }

    setHistoryIndex(nextIndex);
    setInput(history[nextIndex] ?? "");
    setCursorPosition(textareaRef.current, (history[nextIndex] ?? "").length);
  }

  function toggleHistorySearch() {
    if (!historySearchOpen) {
      setHistorySearchOpen(true);
      setHistorySearchQuery("");
      setHistorySearchIndex(0);
      return;
    }

    if (historyMatches.length > 0) {
      setHistorySearchIndex((index) =>
        Math.min(index + 1, historyMatches.length - 1),
      );
    }
  }

  async function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (historySearchOpen) {
      if (event.key === "Escape") {
        event.preventDefault();
        setHistorySearchOpen(false);
        setHistorySearchQuery("");
        setHistorySearchIndex(0);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        if (activeHistoryMatch) {
          setInput(activeHistoryMatch);
          setCursorPosition(textareaRef.current, activeHistoryMatch.length);
        }
        setHistorySearchOpen(false);
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        setHistorySearchQuery((query) => query.slice(0, -1));
        setHistorySearchIndex(0);
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "r") {
        event.preventDefault();
        toggleHistorySearch();
        return;
      }

      if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key.length === 1) {
        event.preventDefault();
        setHistorySearchQuery((query) => query + event.key);
        setHistorySearchIndex(0);
      }
      return;
    }

    if (event.ctrlKey && event.key.toLowerCase() === "c") {
      if (status === "submitted" || status === "streaming") {
        event.preventDefault();
        await stop();
      }
      return;
    }

    if (event.key === "Escape" && (status === "submitted" || status === "streaming")) {
      event.preventDefault();
      await stop();
      return;
    }

    if (event.ctrlKey && event.key.toLowerCase() === "l") {
      event.preventDefault();
      setScreenStartIndex(messages.length);
      return;
    }

    if (event.ctrlKey && event.key.toLowerCase() === "r") {
      event.preventDefault();
      toggleHistorySearch();
      return;
    }

    if (event.ctrlKey && event.key.toLowerCase() === "o") {
      event.preventDefault();
      setVerboseOutput((value) => !value);
      return;
    }

    if (
      event.key === "?" &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      input.length === 0 &&
      suggestions.length === 0
    ) {
      event.preventDefault();
      setShowShortcuts((current) => !current);
      return;
    }

    if (event.ctrlKey && event.key.toLowerCase() === "j") {
      event.preventDefault();
      replaceSelection(textareaRef.current, input, setInput, "\n");
      return;
    }

    if (event.key === "ArrowDown" && suggestions.length > 0) {
      event.preventDefault();
      setSelectedSuggestion((index) => (index + 1) % suggestions.length);
      return;
    }

    if (event.key === "ArrowUp" && suggestions.length > 0) {
      event.preventDefault();
      setSelectedSuggestion((index) =>
        index <= 0 ? suggestions.length - 1 : index - 1,
      );
      return;
    }

    if (event.key === "Tab" && suggestions.length > 0) {
      event.preventDefault();
      const suggestion = suggestions[selectedSuggestion];
      if (!suggestion) {
        return;
      }
      const nextValue = `/${suggestion.name}`;
      setInput(nextValue);
      setCursorPosition(textareaRef.current, nextValue.length);
      return;
    }

    if (
      event.key === "ArrowUp" &&
      suggestions.length === 0 &&
      isCaretOnFirstLine(textareaRef.current, input)
    ) {
      event.preventDefault();
      navigateHistory("up");
      return;
    }

    if (
      event.key === "ArrowDown" &&
      suggestions.length === 0 &&
      isCaretOnLastLine(textareaRef.current, input)
    ) {
      event.preventDefault();
      navigateHistory("down");
      return;
    }

    if (
      event.key === "Tab" &&
      !event.shiftKey &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      suggestions.length === 0
    ) {
      event.preventDefault();
      setExtendedThinking((value) => !value);
      return;
    }

    if (event.key === "Enter" && (event.shiftKey || event.altKey)) {
      event.preventDefault();
      replaceSelection(textareaRef.current, input, setInput, "\n");
      return;
    }

    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      textareaRef.current &&
      textareaRef.current.selectionStart === textareaRef.current.selectionEnd &&
      input[Math.max(0, textareaRef.current.selectionStart - 1)] === "\\"
    ) {
      event.preventDefault();
      replaceSelection(textareaRef.current, input, setInput, "\n", true);
      return;
    }

    if (event.key === "Enter" && suggestions.length > 0) {
      event.preventDefault();
      await handleSubmitSuggestion();
      return;
    }

    if (event.key === "Enter" && !event.shiftKey && !event.altKey && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      await submitCurrentInput();
    }
  }

  const isThinking = status === "submitted" || status === "streaming";
  const effectiveShowShortcuts =
    showShortcuts &&
    input.length === 0 &&
    !historySearchOpen &&
    suggestions.length === 0 &&
    !isThinking;
  const showSpinner = isThinking && messages[messages.length - 1]?.role === "user";
  const errorNode: TranscriptNode | null = error
    ? {
        id: "transport-error",
        type: "assistant-error",
        text: error.message,
      }
    : null;
  const showWelcome = screenStartIndex === 0 || messages.length === 0;
  const promptInput = (
    <InputArea
      disabled={false}
      isLoading={isThinking}
      input={input}
      onInputChange={(value) => {
        setInput(value);
        setSelectedSuggestion(0);
        if (error) {
          clearError();
        }
      }}
      onKeyDown={handleKeyDown}
      selectedSuggestion={selectedSuggestion}
      suggestions={suggestions}
      textareaRef={textareaRef}
      historySearch={{
        open: historySearchOpen,
        query: historySearchQuery,
        match: activeHistoryMatch,
        current: historyMatches.length === 0 ? 0 : historySearchIndex + 1,
        total: historyMatches.length,
      }}
      showShortcuts={effectiveShowShortcuts}
    />
  );

  return (
    <div
      className={`${hackNerdMono.className} cc-terminal-font flex h-full min-h-0 flex-col bg-cc-bg text-[12px] leading-[1.2] text-cc-text`}
      onClick={handleTerminalClick}
    >
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onWheelCapture={handleWheelCapture}
        onTouchStartCapture={handleTouchStartCapture}
        onTouchMoveCapture={handleTouchMoveCapture}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <div className="flex min-h-full flex-col px-[1px] pt-[1px] pb-3">
          {showWelcome ? <Welcome /> : null}

          {transcript.map((node) => (
            <Message key={node.id} node={node} />
          ))}

          {showSpinner ? (
            <div className="mt-2 flex items-baseline px-1">
              <span className="w-4 shrink-0 text-cc-claude select-none">
                {SPINNER_SEQUENCE[spinnerFrame]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-cc-claude">
                  {SPINNER_MESSAGES[spinnerMessageIndex]}...
                </span>
                <span className="text-cc-secondary">
                  {" "}({spinnerElapsed}s)
                </span>
              </span>
            </div>
          ) : null}

          {errorNode ? <Message node={errorNode} /> : null}

          <div aria-hidden="true" className="h-[1.2em]" />

          {promptInput}

        </div>
      </div>
    </div>
  );
}
