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

// --- Rate limiting (in-memory, per-IP) ---
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 50; // 50 requests per hour per IP — generous for curious visitors
const hits = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_REQUESTS;
}

// Clean up stale entries every 10 minutes
if (typeof globalThis !== "undefined") {
  const cleanup = () => {
    const now = Date.now();
    for (const [ip, entry] of hits) {
      if (now > entry.resetAt) hits.delete(ip);
    }
  };
  setInterval(cleanup, 10 * 60 * 1000);
}

// --- Allowed origins ---
const ALLOWED_ORIGINS = [
  "https://richietan.dev",
  "https://www.richietan.dev",
  "http://localhost:3000",
  "http://localhost:3002",
];

export async function POST(req: Request) {
  // Origin check
  const origin = req.headers.get("origin") || req.headers.get("referer") || "";
  const originAllowed =
    ALLOWED_ORIGINS.some((o) => origin.startsWith(o)) ||
    process.env.NODE_ENV === "development";
  if (!originAllowed) {
    return new Response("Forbidden", { status: 403 });
  }

  // Rate limit
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (isRateLimited(ip)) {
    return new Response("Rate limit exceeded. Try again later.", {
      status: 429,
    });
  }

  const body = await req.json();
  const { messages } = body as { messages: UIMessage[] };

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(3),
    maxOutputTokens: 1024,
  });

  return result.toUIMessageStreamResponse();
}
