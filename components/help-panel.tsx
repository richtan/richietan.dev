"use client";

import { SLASH_COMMANDS } from "@/lib/constants";

function padRight(value: string, width: number) {
  return value + " ".repeat(Math.max(0, width - value.length));
}

export function HelpPanel() {
  const commandWidth = Math.max(...SLASH_COMMANDS.map((command) => command.name.length)) + 3;
  const lines = [
    "Claude Code browser shortcuts",
    "",
    "This shell mirrors Claude Code's REPL feel while staying focused on",
    "Richie Tan's resume, projects, skills, and contact details.",
    "",
    "Common tasks",
    "  > what experience does Richie have?",
    "  > /projects",
    "  > /skills",
    "  > /contact",
    "",
    "Interactive mode commands",
    ...SLASH_COMMANDS.map((command) =>
      `  /${padRight(command.name, commandWidth)}${command.description}`,
    ),
    "",
    "Keyboard",
    "  ? opens shortcuts · Tab toggles thinking · Ctrl+O expands tool details",
    "  Ctrl+R searches history · Ctrl+L clears the screen · Esc or Ctrl+C interrupts",
  ].join("\n");

  return (
    <pre className="m-0 whitespace-pre-wrap break-words px-1 text-[13px] leading-5 text-cc-secondary">
      <span className="text-cc-claude">Claude Code browser shortcuts</span>
      {"\n"}
      {lines.split("\n").slice(1).join("\n")}
    </pre>
  );
}
