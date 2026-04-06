"use client";

import { SLASH_COMMANDS } from "@/lib/constants";

export function HelpPanel() {
  return (
    <div className="px-1 text-[13px] leading-5">
      <div className="font-semibold text-cc-claude">Claude Code browser shortcuts</div>
      <div className="mt-2 text-cc-secondary">
        This shell mirrors Claude Code’s REPL feel while keeping the assistant focused
        on Richie Tan’s resume, projects, skills, and contact details.
      </div>

      <div className="mt-3 font-semibold text-cc-text">Common tasks</div>
      <div className="mt-1 space-y-1 text-cc-secondary">
        <div>
          Ask about experience <span className="text-cc-text">&gt; what experience does Richie have?</span>
        </div>
        <div>
          Browse projects <span className="text-cc-text">&gt; /projects</span>
        </div>
        <div>
          Review skills <span className="text-cc-text">&gt; /skills</span>
        </div>
        <div>
          Get contact info <span className="text-cc-text">&gt; /contact</span>
        </div>
      </div>

      <div className="mt-3 font-semibold text-cc-text">Interactive mode commands</div>
      <div className="mt-1 space-y-1">
        {SLASH_COMMANDS.map((command) => (
          <div key={command.name}>
            <span className="font-semibold text-cc-text">/{command.name}</span>
            <span className="text-cc-secondary">{" - "}{command.description}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 text-cc-secondary">
        Keyboard: <span className="text-cc-text">?</span> opens shortcuts,{" "}
        <span className="text-cc-text">Tab</span> toggles thinking,{" "}
        <span className="text-cc-text">Ctrl+O</span> expands tool details,{" "}
        <span className="text-cc-text">Ctrl+R</span> searches history,{" "}
        <span className="text-cc-text">Ctrl+L</span> clears the screen,{" "}
        <span className="text-cc-text">Esc</span> or{" "}
        <span className="text-cc-text">Ctrl+C</span> interrupts a request.
      </div>
    </div>
  );
}
