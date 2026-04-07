export const CLAUDE_CWD = "/private/tmp";
export const CLAUDE_DISPLAY_CWD = "~/richietan.dev";
export const CLAUDE_HEADER_TITLE = "Claude Code v2.1.92";
export const CLAUDE_HEADER_SUBTITLE = "Sonnet 4.6 · Claude Max";
export const CLAUDE_FOOTER_STATUS = "/resume";

export const SLASH_COMMANDS = [
  {
    name: "help",
    description: "Get usage help",
    kind: "local",
  },
  {
    name: "resume",
    description: "View Richie's resume and work experience",
    kind: "prompt",
    prompt: "Show me Richie's resume and work experience.",
  },
  {
    name: "projects",
    description: "Browse Richie's projects",
    kind: "prompt",
    prompt: "What projects has Richie built?",
  },
  {
    name: "skills",
    description: "View Richie's technical skills",
    kind: "prompt",
    prompt: "What are Richie's technical skills?",
  },
  {
    name: "contact",
    description: "Get Richie's contact information",
    kind: "prompt",
    prompt: "How can I contact Richie?",
  },
  {
    name: "clear",
    description: "Clear conversation history",
    kind: "local",
  },
] as const;

export type SlashCommandName = (typeof SLASH_COMMANDS)[number]["name"];

export function getSlashCommand(name: string) {
  return SLASH_COMMANDS.find((command) => command.name === name);
}

export const SLASH_COMMAND_PROMPTS = Object.fromEntries(
  SLASH_COMMANDS.filter(
    (command): command is Extract<(typeof SLASH_COMMANDS)[number], { kind: "prompt" }> =>
      command.kind === "prompt",
  ).map((command) => [command.name, command.prompt]),
) as Record<
  Extract<(typeof SLASH_COMMANDS)[number], { kind: "prompt" }>["name"],
  string
>;
