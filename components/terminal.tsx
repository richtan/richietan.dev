"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import type { UIMessage, ChatStatus } from "ai";
import { Welcome } from "./welcome";
import { Message } from "./message";
import { ThinkingIndicator } from "./thinking";
import { InputArea } from "./input-area";
import { Markdown } from "./markdown";
import { SLASH_COMMANDS } from "@/lib/constants";

interface TerminalProps {
  messages: UIMessage[];
  status: ChatStatus;
  sendMessage: (message: { text: string }) => void;
  setMessages: (
    messages: UIMessage[] | ((messages: UIMessage[]) => UIMessage[]),
  ) => void;
}

interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function Terminal({
  messages,
  status,
  sendMessage,
  setMessages,
}: TerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, status, autoScroll, localMessages]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setAutoScroll(atBottom);
  }, []);

  const handleSend = useCallback(
    (text: string) => {
      // Handle /help locally
      if (text === "/help") {
        const helpText = SLASH_COMMANDS.map(
          (cmd) => `  **${cmd.name}**  ${cmd.description}`,
        ).join("\n");
        setLocalMessages((prev) => [
          ...prev,
          { id: `lq-${Date.now()}`, role: "user", content: "/help" },
          {
            id: `la-${Date.now()}`,
            role: "assistant",
            content: `Available commands:\n\n${helpText}\n\nOr just ask me anything about Richie.`,
          },
        ]);
        return;
      }

      // Map slash commands to descriptive prompts
      const commandMap: Record<string, string> = {
        resume: "Show me Richie's resume and work experience.",
        projects: "What projects has Richie built?",
        skills: "What are Richie's technical skills?",
        contact: "How can I contact Richie?",
      };

      sendMessage({ text: commandMap[text] || text });
    },
    [sendMessage],
  );

  const handleClear = useCallback(() => {
    setMessages([]);
    setLocalMessages([]);
  }, [setMessages]);

  const isThinking = status === "submitted" || status === "streaming";
  const showSpinner =
    isThinking &&
    (messages.length === 0 ||
      messages[messages.length - 1]?.role === "user");

  return (
    <div className="flex h-full flex-col">
      {/* Scrollable message area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 pt-4 pb-2"
      >
        <Welcome />

        {/* Local messages (help, etc.) */}
        {localMessages.map((msg) =>
          msg.role === "user" ? (
            <div key={msg.id} className="mt-4">
              <div className="flex">
                <span className="w-5 shrink-0 text-cc-secondary select-none">
                  {">"}
                </span>
                <span className="text-cc-secondary">{msg.content}</span>
              </div>
            </div>
          ) : (
            <div key={msg.id} className="mt-4">
              <div className="flex">
                <span className="w-5 shrink-0 select-none">⏺</span>
                <div className="min-w-0 flex-1">
                  <Markdown content={msg.content} />
                </div>
              </div>
            </div>
          ),
        )}

        {/* AI messages */}
        {messages.map((msg) => (
          <Message key={msg.id} message={msg} />
        ))}

        {/* Thinking spinner */}
        {showSpinner && <ThinkingIndicator />}

        <div ref={bottomRef} />
      </div>

      {/* Input area with border box + hints */}
      <div className="shrink-0 px-2 pb-3">
        <InputArea
          onSend={handleSend}
          onClear={handleClear}
          disabled={isThinking}
        />
      </div>
    </div>
  );
}
