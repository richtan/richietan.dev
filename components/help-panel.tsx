"use client";

import {
  CLAUDE_HEADER_TITLE,
  SLASH_COMMANDS,
} from "@/lib/constants";
import { getPromptHelpMenuColumns } from "@/lib/terminal-shortcuts";

function padRight(value: string, width: number) {
  return value + " ".repeat(Math.max(0, width - value.length));
}

export function HelpPanel() {
  const commandWidth = Math.max(...SLASH_COMMANDS.map((command) => command.name.length)) + 3;
  const shortcutColumns = getPromptHelpMenuColumns({ supportsThinkingToggle: true });
  const shortcutRowCount = Math.max(...shortcutColumns.map((column) => column.length));

  return (
    <div className="text-cc-text">
      <div className="h-px w-full bg-cc-suggestion" />

      <div className="flex items-center gap-3 px-2 pt-[1.2em]">
        <span className="font-semibold text-cc-suggestion">{CLAUDE_HEADER_TITLE}</span>
        <span className="bg-cc-suggestion px-1 font-semibold text-cc-bg">general</span>
      </div>

      <div className="px-2 pt-[2.4em]">
        <div>Ask about Richie Tan&apos;s experience, projects, skills, and contact details.</div>

        <div className="pt-[2.4em] font-semibold">Shortcuts</div>
        <div className="grid grid-cols-[24ch_35ch_1fr] gap-x-2">
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

        <div className="pt-[2.4em] font-semibold">Commands</div>
        <div>
          {SLASH_COMMANDS.map((command) => (
            <div key={command.name} className="whitespace-pre-wrap break-words">
              <span className="text-cc-suggestion">
                {`/${padRight(command.name, commandWidth)}`}
              </span>
              <span>{command.description}</span>
            </div>
          ))}
        </div>

        <div className="pt-[2.4em]">
          Give this a star at{" "}
          <a
            href="https://github.com/richtan/richietan.dev"
            target="_blank"
            rel="noreferrer"
            className="text-cc-suggestion underline underline-offset-2"
          >
            https://github.com/richtan/richietan.dev
          </a>
        </div>

        <div className="pt-[2.4em] italic text-cc-secondary">Esc to cancel</div>
      </div>
    </div>
  );
}
