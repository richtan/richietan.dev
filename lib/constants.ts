export const SLASH_COMMANDS = [
  { name: "/help", description: "Show available commands" },
  { name: "/resume", description: "View Richie's resume" },
  { name: "/projects", description: "Browse Richie's projects" },
  { name: "/skills", description: "View technical skills" },
  { name: "/contact", description: "Get contact information" },
  { name: "/clear", description: "Clear the conversation" },
] as const;

export type SlashCommand = (typeof SLASH_COMMANDS)[number]["name"];
