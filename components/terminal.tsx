"use client";

import { useChat } from "@ai-sdk/react";
import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { hackNerdMono } from "@/app/fonts";
import { Welcome } from "./welcome";
import { Message } from "./message";
import { InputArea } from "./input-area";
import { CLAUDE_CWD, getSlashCommand, SLASH_COMMANDS } from "@/lib/constants";
import { DOUBLE_ESCAPE_TIMEOUT_MS } from "@/lib/terminal-shortcuts";
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
const wordSegmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "word" })
    : null;

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

function setSelectionRange(
  textarea: HTMLTextAreaElement | null,
  start: number,
  end = start,
) {
  if (!textarea) {
    return;
  }

  requestAnimationFrame(() => {
    textarea.selectionStart = start;
    textarea.selectionEnd = end;
  });
}

function getSelectionRange(textarea: HTMLTextAreaElement | null) {
  return {
    start: textarea?.selectionStart ?? 0,
    end: textarea?.selectionEnd ?? 0,
  };
}

function getLineStart(value: string, position: number) {
  const previousNewline = value.lastIndexOf("\n", Math.max(0, position - 1));
  return previousNewline === -1 ? 0 : previousNewline + 1;
}

function getLineEnd(value: string, position: number) {
  const nextNewline = value.indexOf("\n", position);
  return nextNewline === -1 ? value.length : nextNewline;
}

function getWordBoundaries(value: string) {
  if (!wordSegmenter) {
    const boundaries: Array<{ start: number; end: number; isWordLike: boolean }> = [];
    const pattern = /\S+/gu;

    for (const match of value.matchAll(pattern)) {
      const segment = match[0];
      const start = match.index ?? 0;
      boundaries.push({
        start,
        end: start + segment.length,
        isWordLike: true,
      });
    }

    return boundaries;
  }

  return Array.from(wordSegmenter.segment(value)).map((segment) => ({
    start: segment.index,
    end: segment.index + segment.segment.length,
    isWordLike: segment.isWordLike ?? /\S/u.test(segment.segment),
  }));
}

function findPreviousWordStart(value: string, position: number) {
  if (position <= 0) {
    return 0;
  }

  let previousWordStart = 0;

  for (const boundary of getWordBoundaries(value)) {
    if (!boundary.isWordLike) {
      continue;
    }

    if (boundary.start < position) {
      if (position > boundary.start && position <= boundary.end) {
        return boundary.start;
      }

      previousWordStart = boundary.start;
    }
  }

  return previousWordStart;
}

function findNextWordStart(value: string, position: number) {
  if (position >= value.length) {
    return value.length;
  }

  for (const boundary of getWordBoundaries(value)) {
    if (boundary.isWordLike && boundary.start > position) {
      return boundary.start;
    }
  }

  return value.length;
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

function isStreamingStatus(status: string) {
  return status === "submitted" || status === "streaming";
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
  } = useChat<AppMessage>();

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
  const [pendingEscapeClear, setPendingEscapeClear] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const [spinnerElapsed, setSpinnerElapsed] = useState(0);
  const [spinnerMessageIndex, setSpinnerMessageIndex] = useState(0);
  const [followOutput, setFollowOutput] = useState(true);
  const touchYRef = useRef<number | null>(null);
  const killBufferRef = useRef("");

  const visibleMessages = messages.slice(screenStartIndex);
  const isThinking = isStreamingStatus(status);

  const transcript = useMemo(
    () => normalizeMessages(visibleMessages, { verboseOutput }),
    [verboseOutput, visibleMessages],
  );
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

  useEffect(() => {
    if (!pendingEscapeClear) {
      return;
    }

    const timer = window.setTimeout(() => {
      setPendingEscapeClear(false);
    }, DOUBLE_ESCAPE_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [pendingEscapeClear]);

  function scrollToBottom() {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }

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
    setFollowOutput(isNearBottom(el));
  }

  function handleWheelCapture(event: React.WheelEvent<HTMLDivElement>) {
    if (event.deltaY < 0) {
      setFollowOutput(false);
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
      setFollowOutput(false);
    }

    touchYRef.current = nextY;
  }

  function focusPrompt() {
    textareaRef.current?.focus({ preventScroll: true });
  }

  function syncSelection(start: number, end = start) {
    setSelection({ start, end });
    setSelectionRange(textareaRef.current, start, end);
  }

  function applyInputEdit(nextValue: string, start: number, end = start) {
    setInput(nextValue);
    setSelectedSuggestion(0);
    setPendingEscapeClear(false);
    if (error) {
      clearError();
    }
    syncSelection(start, end);
  }

  function moveCursor(nextPosition: number) {
    setPendingEscapeClear(false);
    syncSelection(nextPosition);
  }

  function insertTextAtSelection(text: string) {
    const { start, end } = getSelectionRange(textareaRef.current);
    const nextValue = `${input.slice(0, start)}${text}${input.slice(end)}`;
    applyInputEdit(nextValue, start + text.length);
  }

  function deleteSelectionOrRange(start: number, end: number, storeKilled = false) {
    if (start === end) {
      return;
    }

    const deletedText = input.slice(start, end);
    if (storeKilled && deletedText.length > 0) {
      killBufferRef.current = deletedText;
    }

    const nextValue = `${input.slice(0, start)}${input.slice(end)}`;
    applyInputEdit(nextValue, start);
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
    setFollowOutput(true);
    scrollToBottom();
    setInput("");
    setShowShortcuts(false);
    setSelectedSuggestion(0);
    setPendingEscapeClear(false);
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
    setFollowOutput(true);
    setInput("");
    setHistory([]);
    setHistoryIndex(null);
    setHistoryDraft("");
    setPendingEscapeClear(false);
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
      applyInputEdit(history[nextIndex] ?? "", (history[nextIndex] ?? "").length);
      return;
    }

    if (direction === "up") {
      const nextIndex = Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      applyInputEdit(history[nextIndex] ?? "", (history[nextIndex] ?? "").length);
      return;
    }

    const nextIndex = historyIndex + 1;
    if (nextIndex >= history.length) {
      setHistoryIndex(null);
      applyInputEdit(historyDraft, historyDraft.length);
      return;
    }

    setHistoryIndex(nextIndex);
    applyInputEdit(history[nextIndex] ?? "", (history[nextIndex] ?? "").length);
  }

  function toggleHistorySearch() {
    setPendingEscapeClear(false);
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
    const closeHistorySearch = () => {
      setHistorySearchOpen(false);
      setHistorySearchQuery("");
      setHistorySearchIndex(0);
    };

    if (historySearchOpen) {
      if (
        (event.key === "Escape" && !event.ctrlKey && !event.metaKey && !event.altKey) ||
        (event.key === "Tab" && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey)
      ) {
        event.preventDefault();
        if (activeHistoryMatch) {
          applyInputEdit(activeHistoryMatch, activeHistoryMatch.length);
        }
        closeHistorySearch();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        if (activeHistoryMatch) {
          closeHistorySearch();
          await submitText(activeHistoryMatch);
          return;
        }
        if (historySearchQuery.length === 0 && input.trim()) {
          closeHistorySearch();
          await submitText(input);
        }
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        if (historySearchQuery.length === 0) {
          closeHistorySearch();
          return;
        }
        setHistorySearchQuery((query) => query.slice(0, -1));
        setHistorySearchIndex(0);
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "r") {
        event.preventDefault();
        toggleHistorySearch();
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        closeHistorySearch();
        return;
      }

      if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key.length === 1) {
        event.preventDefault();
        setHistorySearchQuery((query) => query + event.key);
        setHistorySearchIndex(0);
      }
      return;
    }

    const lowerKey = event.key.toLowerCase();
    const textarea = textareaRef.current;
    const { start, end } = getSelectionRange(textarea);
    const hasSelection = start !== end;
    const isModifierOnly =
      event.key === "Shift" ||
      event.key === "Control" ||
      event.key === "Alt" ||
      event.key === "Meta";

    if (pendingEscapeClear && event.key !== "Escape" && !isModifierOnly) {
      setPendingEscapeClear(false);
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

    if (
      event.key === "Escape" &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      input.length > 0
    ) {
      event.preventDefault();
      if (pendingEscapeClear) {
        if (input.trim()) {
          pushHistoryEntry(input);
        }
        applyInputEdit("", 0);
        setPendingEscapeClear(false);
      } else {
        setPendingEscapeClear(true);
      }
      return;
    }

    if (event.ctrlKey && lowerKey === "l") {
      event.preventDefault();
      setScreenStartIndex(messages.length);
      return;
    }

    if (event.ctrlKey && lowerKey === "r") {
      event.preventDefault();
      toggleHistorySearch();
      return;
    }

    if (event.ctrlKey && lowerKey === "o") {
      event.preventDefault();
      setVerboseOutput((value) => !value);
      return;
    }

    if (event.altKey && !event.ctrlKey && !event.metaKey && lowerKey === "t") {
      event.preventDefault();
      setExtendedThinking((value) => !value);
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

    if (event.ctrlKey && lowerKey === "a") {
      event.preventDefault();
      moveCursor(getLineStart(input, start));
      return;
    }

    if (event.ctrlKey && lowerKey === "e") {
      event.preventDefault();
      moveCursor(getLineEnd(input, end));
      return;
    }

    if (event.ctrlKey && lowerKey === "b") {
      event.preventDefault();
      moveCursor(hasSelection ? start : Math.max(0, start - 1));
      return;
    }

    if (event.ctrlKey && lowerKey === "f") {
      event.preventDefault();
      moveCursor(hasSelection ? end : Math.min(input.length, end + 1));
      return;
    }

    if (
      event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      (lowerKey === "b" || event.key === "ArrowLeft")
    ) {
      event.preventDefault();
      moveCursor(findPreviousWordStart(input, start));
      return;
    }

    if (
      event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      (lowerKey === "f" || event.key === "ArrowRight")
    ) {
      event.preventDefault();
      moveCursor(findNextWordStart(input, end));
      return;
    }

    if (event.ctrlKey && lowerKey === "h") {
      event.preventDefault();
      if (hasSelection) {
        deleteSelectionOrRange(start, end);
      } else if (start > 0) {
        deleteSelectionOrRange(start - 1, start);
      }
      return;
    }

    if (event.ctrlKey && lowerKey === "d") {
      event.preventDefault();
      if (hasSelection) {
        deleteSelectionOrRange(start, end);
      } else if (start < input.length) {
        deleteSelectionOrRange(start, start + 1);
      }
      return;
    }

    if (event.ctrlKey && lowerKey === "u") {
      event.preventDefault();
      if (hasSelection) {
        deleteSelectionOrRange(start, end, true);
      } else {
        deleteSelectionOrRange(getLineStart(input, start), start, true);
      }
      return;
    }

    if (event.ctrlKey && lowerKey === "k") {
      event.preventDefault();
      if (hasSelection) {
        deleteSelectionOrRange(start, end, true);
      } else {
        deleteSelectionOrRange(end, getLineEnd(input, end), true);
      }
      return;
    }

    if (event.ctrlKey && lowerKey === "w") {
      event.preventDefault();
      if (hasSelection) {
        deleteSelectionOrRange(start, end, true);
      } else {
        deleteSelectionOrRange(findPreviousWordStart(input, start), start, true);
      }
      return;
    }

    if (event.ctrlKey && lowerKey === "y") {
      event.preventDefault();
      if (killBufferRef.current.length > 0) {
        insertTextAtSelection(killBufferRef.current);
      }
      return;
    }

    if (
      event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      event.key === "Backspace"
    ) {
      event.preventDefault();
      if (hasSelection) {
        deleteSelectionOrRange(start, end, true);
      } else {
        deleteSelectionOrRange(findPreviousWordStart(input, start), start, true);
      }
      return;
    }

    if (event.altKey && !event.ctrlKey && !event.metaKey && lowerKey === "d") {
      event.preventDefault();
      if (hasSelection) {
        deleteSelectionOrRange(start, end, true);
      } else {
        deleteSelectionOrRange(end, findNextWordStart(input, end), true);
      }
      return;
    }

    if (event.ctrlKey && lowerKey === "j") {
      event.preventDefault();
      insertTextAtSelection("\n");
      return;
    }

    if ((event.key === "ArrowDown" || (event.ctrlKey && lowerKey === "n")) && suggestions.length > 0) {
      event.preventDefault();
      setSelectedSuggestion((index) => (index + 1) % suggestions.length);
      return;
    }

    if ((event.key === "ArrowUp" || (event.ctrlKey && lowerKey === "p")) && suggestions.length > 0) {
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
      applyInputEdit(nextValue, nextValue.length);
      return;
    }

    if (event.ctrlKey && lowerKey === "p" && suggestions.length === 0) {
      event.preventDefault();
      navigateHistory("up");
      return;
    }

    if (event.ctrlKey && lowerKey === "n" && suggestions.length === 0) {
      event.preventDefault();
      navigateHistory("down");
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
      return;
    }

    if (event.key === "Enter" && (event.shiftKey || event.altKey)) {
      event.preventDefault();
      insertTextAtSelection("\n");
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
      const insertStart = Math.max(0, start - 1);
      const nextValue = `${input.slice(0, insertStart)}\n${input.slice(end)}`;
      applyInputEdit(nextValue, insertStart + 1);
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

  const effectiveShowShortcuts =
    showShortcuts &&
    input.length === 0 &&
    !historySearchOpen &&
    suggestions.length === 0 &&
    !isThinking;
  const showSpinner = isThinking && messages[messages.length - 1]?.role === "user";
  const streamingAssistantTextId = useMemo(() => {
    if (!isThinking) {
      return null;
    }

    for (let index = transcript.length - 1; index >= 0; index -= 1) {
      const node = transcript[index];
      if (node?.type === "assistant-text") {
        return node.id;
      }
    }

    return null;
  }, [isThinking, transcript]);
  const errorNode: TranscriptNode | null = useMemo(
    () =>
      error
        ? {
            id: "transport-error",
            type: "assistant-error",
            text: error.message,
          }
        : null,
    [error],
  );
  const showWelcome = screenStartIndex === 0 || messages.length === 0;
  const scrollEventKey = useMemo(
    () =>
      [
        ...transcript.map((node) => {
          switch (node.type) {
            case "user-prompt":
              return `${node.id}:${node.type}:${node.text.length}`;
            case "user-command":
              return `${node.id}:${node.type}:${node.command.length}`;
            case "assistant-text":
            case "assistant-thinking":
            case "assistant-error":
            case "tip":
              return `${node.id}:${node.type}:${node.text.length}`;
            case "tool-summary":
              return `${node.id}:${node.type}:${node.state}:${node.detail ?? ""}`;
            case "tool-detail":
              return `${node.id}:${node.type}:${node.status}:${node.text.length}`;
            case "local-panel":
              return `${node.id}:${node.type}:${node.panel}`;
          }
        }),
        `spinner:${showSpinner ? 1 : 0}`,
        errorNode ? `error:${errorNode.text.length}` : "error:0",
      ].join("|"),
    [errorNode, showSpinner, transcript],
  );

  useEffect(() => {
    if (!followOutput) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      scrollToBottom();
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [followOutput, scrollEventKey]);
  const promptInput = (
    <InputArea
      disabled={false}
      isLoading={isThinking}
      input={input}
      onInputChange={(value) => {
        setInput(value);
        setSelectedSuggestion(0);
        setPendingEscapeClear(false);
        if (error) {
          clearError();
        }
      }}
      onSelectionChange={(start, end) => {
        setSelection({ start, end });
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
      escapeClearPending={pendingEscapeClear}
      selectionEnd={selection.end}
    />
  );
  const transcriptContent = (
    <>
      {showWelcome ? <Welcome /> : null}

      {transcript.map((node) => (
        <Message
          key={node.id}
          node={node}
          streaming={node.type === "assistant-text" && node.id === streamingAssistantTextId}
        />
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

      <div className="pt-[1.2em]">
        {promptInput}
      </div>
    </>
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
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <div className="flex min-h-full flex-col px-[1px] pt-[1px] pb-4">
          {transcriptContent}
        </div>
      </div>
    </div>
  );
}
