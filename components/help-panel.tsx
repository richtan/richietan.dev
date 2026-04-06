"use client";

import {
  CLAUDE_HEADER_TITLE,
  SLASH_COMMANDS,
} from "@/lib/constants";

function padRight(value: string, width: number) {
  return value + " ".repeat(Math.max(0, width - value.length));
}

export function HelpPanel() {
  const commandWidth = Math.max(...SLASH_COMMANDS.map((command) => command.name.length)) + 3;
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
    "  ? opens shortcuts · Tab toggles thinking · Ctrl+O expands tool details",
    "  Ctrl+R searches history · Ctrl+L clears the screen · Esc or Ctrl+C interrupts",
  ].join("\n");

  return (
    <pre className="m-0 whitespace-pre-wrap break-words px-1 text-cc-secondary">
      <span className="text-cc-claude">{CLAUDE_HEADER_TITLE}</span>
      {"\n"}
      {lines.split("\n").slice(1).join("\n")}
    </pre>
  );
}
