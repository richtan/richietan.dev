export const DOUBLE_ESCAPE_TIMEOUT_MS = 1000;

type ShortcutOptions = {
  supportsThinkingToggle?: boolean;
};

function basePromptHelpColumns({ supportsThinkingToggle }: ShortcutOptions) {
  const promptColumn = ["/ for commands"];

  const commandColumn = [
    "double tap esc to clear input",
    "ctrl + o for verbose output",
    "shift + ↵ or alt + ↵ for newline",
  ];

  const utilityColumn = [
    "ctrl + l to clear screen",
    "ctrl + r to search history",
  ];

  if (supportsThinkingToggle) {
    utilityColumn.push("alt + t to toggle thinking");
  }

  return [promptColumn, commandColumn, utilityColumn] as const;
}

export function getPromptHelpMenuColumns(
  options: ShortcutOptions = {},
) {
  return basePromptHelpColumns(options);
}

export function getHelpPanelKeyboardLines(
  options: ShortcutOptions = {},
) {
  return [
    "? opens shortcuts · / opens commands · Ctrl+R searches history",
    options.supportsThinkingToggle
      ? "Ctrl+O expands tool details · Alt+T toggles thinking · Ctrl+L clears the screen"
      : "Ctrl+O expands tool details · Ctrl+L clears the screen",
    "Esc or Ctrl+C interrupts · Ctrl+A/E/B/F move the cursor",
    "Ctrl+H/D/U/K/W/Y edit and yank · Alt+B/F and Alt+Backspace/D work by word",
  ];
}
