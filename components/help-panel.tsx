"use client";

import {
  CLAUDE_HEADER_TITLE,
  SLASH_COMMANDS,
} from "@/lib/constants";
import { getHelpPanelKeyboardLines } from "@/lib/terminal-shortcuts";

function padRight(value: string, width: number) {
  return value + " ".repeat(Math.max(0, width - value.length));
}

export function HelpPanel() {
  const commandWidth = Math.max(...SLASH_COMMANDS.map((command) => command.name.length)) + 3;
  const keyboardLines = getHelpPanelKeyboardLines({ supportsThinkingToggle: true });
  const lines = [
    CLAUDE_HEADER_TITLE,
    "",
    "Ask about Richie Tan's experience, projects, skills, and contact details.",
    "",
    "Available tasks",
    "  > what experience does Richie have?",
    "  > /projects",
    "  > /skills",
    "  > /contact",
    "",
    "Commands",
    ...SLASH_COMMANDS.map((command) =>
      `  /${padRight(command.name, commandWidth)}${command.description}`,
    ),
    "",
    "Keyboard",
    ...keyboardLines.map((line) => `  ${line}`),
  ].join("\n");

  return (
    <pre className="m-0 whitespace-pre-wrap break-words px-1 text-cc-secondary">
      <span className="text-cc-claude">{CLAUDE_HEADER_TITLE}</span>
      {"\n"}
      {lines.split("\n").slice(1).join("\n")}
    </pre>
  );
}
