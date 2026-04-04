import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  type UIMessage,
} from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { systemPrompt } from "@/lib/system-prompt";
import { tools } from "@/lib/tools";

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json();
  const { messages } = body as { messages: UIMessage[] };

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(3),
  });

  return result.toUIMessageStreamResponse();
}
