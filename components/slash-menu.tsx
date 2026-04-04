"use client";

import { SLASH_COMMANDS } from "@/lib/constants";

interface SlashMenuProps {
  filter: string;
  selectedIndex: number;
  onSelect: (command: string) => void;
}

export function SlashMenu({ filter, selectedIndex, onSelect }: SlashMenuProps) {
  const filtered = SLASH_COMMANDS.filter((cmd) =>
    cmd.name.startsWith(filter.toLowerCase()),
  );

  if (filtered.length === 0) return null;

  // Calculate column width for alignment
  const maxNameLen = Math.max(...filtered.map((c) => c.name.length));

  return (
    <div className="px-2 pt-1">
      {filtered.map((cmd, i) => {
        const isSelected = i === selectedIndex;
        return (
          <button
            key={cmd.name}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(cmd.name);
            }}
            className={`block w-full text-left font-mono text-sm ${
              isSelected ? "text-cc-suggestion" : "text-cc-secondary/40"
            }`}
          >
            <span className="inline-block" style={{ width: `${maxNameLen + 5}ch` }}>
              {cmd.name}
            </span>
            <span>{cmd.description}</span>
          </button>
        );
      })}
    </div>
  );
}
