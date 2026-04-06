import type { UIMessage } from "ai";

export interface AppMessageMetadata {
  localPanel?: "help";
  localError?: boolean;
}

export type AppMessage = UIMessage<AppMessageMetadata>;

export type TranscriptNode =
  | {
      id: string;
      type: "user-prompt";
      text: string;
    }
  | {
      id: string;
      type: "user-command";
      command: string;
    }
  | {
      id: string;
      type: "assistant-text";
      text: string;
    }
  | {
      id: string;
      type: "assistant-thinking";
      text: string;
    }
  | {
      id: string;
      type: "tool-summary";
      title: string;
      detail?: string;
      state: "running" | "success" | "error" | "denied";
    }
  | {
      id: string;
      type: "tool-detail";
      status: "success" | "error" | "denied";
      text: string;
      multiline: boolean;
    }
  | {
      id: string;
      type: "tip";
      text: string;
    }
  | {
      id: string;
      type: "assistant-error";
      text: string;
    }
  | {
      id: string;
      type: "local-panel";
      panel: "help";
    };

function isToolPart(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  part: any,
): part is
  | {
      type: string;
      toolName?: string;
      state: string;
      input?: unknown;
      output?: unknown;
      errorText?: string;
    }
  | {
      type: "dynamic-tool";
      toolName: string;
      state: string;
      input?: unknown;
      output?: unknown;
      errorText?: string;
    } {
  return (
    part.type === "dynamic-tool" ||
    (typeof part.type === "string" && part.type.startsWith("tool-"))
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getToolName(part: any) {
  return part.type === "dynamic-tool" ? part.toolName : part.type.replace("tool-", "");
}

function getMessageText(message: AppMessage) {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();
}

function getToolDisplay(toolName: string) {
  switch (toolName) {
    case "get_resume":
      return {
        title: "Resume",
        detail: "Load LaTeX resume source",
      };
    case "get_projects":
      return {
        title: "Projects",
        detail: "Load portfolio repositories",
      };
    case "get_skills":
      return {
        title: "Skills",
        detail: "Load GitHub language stats",
      };
    case "get_contact":
      return {
        title: "Contact",
        detail: "Load profile links",
      };
    case "get_github_stats":
      return {
        title: "GitHub",
        detail: "Load live profile stats",
      };
    default:
      return {
        title: toolName.replace(/_/g, " "),
        detail: undefined,
      };
  }
}

function summarizeToolOutput(toolName: string, output: unknown) {
  if (toolName === "get_resume" && output && typeof output === "object") {
    return "Loaded LaTeX resume source";
  }

  if (toolName === "get_projects" && output && typeof output === "object") {
    const record = output as Record<string, unknown>;
    const pinnedRepos = record.pinnedRepos;
    const recentRepos = record.recentRepos;
    const pinned = Array.isArray(pinnedRepos)
      ? pinnedRepos.length
      : 0;
    const recent = Array.isArray(recentRepos)
      ? recentRepos.length
      : 0;
    return `Loaded ${pinned} pinned repos · ${recent} recent repos`;
  }

  if (toolName === "get_skills" && output && typeof output === "object") {
    const record = output as Record<string, unknown>;
    const languages = Array.isArray(record.githubLanguages)
      ? record.githubLanguages.length
      : 0;
    return `Loaded ${languages} language stats`;
  }

  if (toolName === "get_contact") {
    return "Loaded contact links";
  }

  if (toolName === "get_github_stats" && output && typeof output === "object") {
    const record = output as Record<string, unknown>;
    const username = record.username;
    if (typeof username === "string") {
      return `Loaded live GitHub stats for ${username}`;
    }
  }

  if (typeof output === "string") {
    return output.trim();
  }

  if (output && typeof output === "object") {
    const keys = Object.keys(output);
    if (keys.length > 0) {
      return `Returned ${keys.join(", ")}`;
    }
  }

  return "Completed";
}

function formatToolResult(
  toolName: string,
  output: unknown,
  verboseOutput: boolean,
) {
  const value = verboseOutput
    ? typeof output === "string"
      ? output
      : JSON.stringify(output, null, 2)
    : summarizeToolOutput(toolName, output);

  const text = value.trim();
  return {
    text,
    multiline: text.includes("\n") || text.length > 120,
    expandable:
      !verboseOutput &&
      (text.includes("\n") ||
        text.length > 96 ||
        (output !== null && typeof output === "object")),
  };
}

function formatToolError(errorText: string, verboseOutput: boolean) {
  if (verboseOutput) {
    return {
      text: errorText.trim(),
      multiline: true,
    };
  }

  const lines = errorText.trim().split("\n");
  const limited = lines.slice(0, 10);
  const suffix =
    lines.length > 10 ? `\n... (+${lines.length - 10} lines)` : "";

  return {
    text: limited.join("\n") + suffix,
    multiline: true,
  };
}

export function createUserTextMessage(text: string): AppMessage {
  return {
    id: crypto.randomUUID(),
    role: "user",
    parts: [{ type: "text", text, state: "done" }],
  };
}

export function createAssistantTextMessage(
  text: string,
  metadata?: AppMessageMetadata,
): AppMessage {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    metadata,
    parts: [{ type: "text", text, state: "done" }],
  };
}

export function createAssistantPanelMessage(
  panel: "help",
): AppMessage {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    metadata: { localPanel: panel },
    parts: [{ type: "text", text: "", state: "done" }],
  };
}

export function normalizeMessages(
  messages: AppMessage[],
  { verboseOutput }: { verboseOutput: boolean },
): TranscriptNode[] {
  const nodes: TranscriptNode[] = [];

  for (const message of messages) {
    if (message.role === "user") {
      const text = getMessageText(message);
      if (!text) {
        continue;
      }

      if (text.startsWith("/")) {
        nodes.push({
          id: `${message.id}-user-command`,
          type: "user-command",
          command: text,
        });
      } else {
        nodes.push({
          id: `${message.id}-user-prompt`,
          type: "user-prompt",
          text,
        });
      }
      continue;
    }

    if (message.metadata?.localPanel) {
      nodes.push({
        id: `${message.id}-panel`,
        type: "local-panel",
        panel: message.metadata.localPanel,
      });
      continue;
    }

    if (message.metadata?.localError) {
      const text = getMessageText(message);
      if (text) {
        nodes.push({
          id: `${message.id}-local-error`,
          type: "assistant-error",
          text,
        });
      }
      continue;
    }

    message.parts.forEach((part, index) => {
      if (part.type === "text") {
        if (part.text.trim()) {
          nodes.push({
            id: `${message.id}-text-${index}`,
            type: "assistant-text",
            text: part.text,
          });
        }
        return;
      }

      if (part.type === "reasoning") {
        if (part.text.trim() || part.state === "streaming") {
          nodes.push({
            id: `${message.id}-reasoning-${index}`,
            type: "assistant-thinking",
            text: part.text,
          });
        }
        return;
      }

      if (part.type === "step-start") {
        return;
      }

      if (!isToolPart(part)) {
        return;
      }

      const toolName = getToolName(part);
      const display = getToolDisplay(toolName);

      if (part.state === "output-available") {
        nodes.push({
          id: `${message.id}-tool-${index}`,
          type: "tool-summary",
          title: display.title,
          detail: display.detail,
          state: "success",
        });

        const result = formatToolResult(toolName, part.output, verboseOutput);
        nodes.push({
          id: `${message.id}-tool-result-${index}`,
          type: "tool-detail",
          status: "success",
          text: result.text,
          multiline: result.multiline,
        });
        if (result.expandable) {
          nodes.push({
            id: `${message.id}-tool-tip-${index}`,
            type: "tip",
            text: "(ctrl+o to expand)",
          });
        }
        return;
      }

      if (part.state === "output-error") {
        nodes.push({
          id: `${message.id}-tool-${index}`,
          type: "tool-summary",
          title: display.title,
          detail: display.detail,
          state: "error",
        });

        const result = formatToolError(part.errorText ?? "Tool execution failed", verboseOutput);
        nodes.push({
          id: `${message.id}-tool-result-${index}`,
          type: "tool-detail",
          status: "error",
          text: result.text,
          multiline: result.multiline,
        });
        return;
      }

      if (part.state === "output-denied") {
        nodes.push({
          id: `${message.id}-tool-${index}`,
          type: "tool-summary",
          title: display.title,
          detail: display.detail,
          state: "denied",
        });
        nodes.push({
          id: `${message.id}-tool-result-${index}`,
          type: "tool-detail",
          status: "denied",
          text: "Interrupted by user",
          multiline: false,
        });
        return;
      }

      nodes.push({
        id: `${message.id}-tool-${index}`,
        type: "tool-summary",
        title: display.title,
        detail: display.detail,
        state: "running",
      });
    });
  }

  return nodes;
}
