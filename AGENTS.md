# Project Guide

## Overview

- This repo is a browser-based Claude Code-inspired personal site for Richie Tan.
- The product goal is Claude Code visual/interaction parity where practical, not a generic chat UI.
- The main user experience is a client-rendered terminal window inside a small macOS-style desktop shell.

## Commands

Use these before handing off changes:

```bash
npm run lint
npm run build
```

Other useful commands:

```bash
npm run dev
npm run start
```

## Environment

- `ANTHROPIC_API_KEY` is required for chat responses.
- `GITHUB_TOKEN` is optional but recommended for pinned repos and GitHub contribution stats.
- Never commit secrets or paste secret values into docs, code comments, or logs.

## Architecture Map

- `app/page.tsx`
  Client-only entrypoint via dynamic import.
- `components/home-shell.tsx`
  Composes desktop, window, and terminal.
- `components/desktop.tsx`
  Desktop surface, application launcher, and snap preview.
- `components/mac-window.tsx`
  Window controls, drag, resize, minimize, maximize, close.
- `components/terminal.tsx`
  Main interaction loop: prompt state, history, reverse search, slash commands, local help, and streaming transcript behavior.
- `components/markdown.tsx`
  Terminal-style markdown renderer. Avoid replacing it with generic markdown/bubble UI behavior.
- `app/api/chat/route.ts`
  Vercel AI SDK streaming route, origin allowlist, in-memory rate limiting, Anthropic model call.
- `lib/tools.ts` and `lib/github.ts`
  Tool definitions and live GitHub-backed data fetches.
- `lib/transcript.ts`
  Transcript normalization layer used by the terminal renderer.
- `lib/constants.ts`
  Slash commands, header/footer copy, and static terminal strings.

## Project Conventions

- Preserve the Claude Code-inspired UX unless the task explicitly changes it.
- The application launcher is the relaunch/restore affordance for reopening Claude.
- Keep root app/browser icons in `app/` using Next metadata file conventions:
  - `app/favicon.ico`
  - `app/icon.png`
  - `app/apple-icon.png`
- Keep `app/page.tsx` client-only unless there is a strong reason to rework the shell architecture.
- When changing prompt/help/shortcut behavior, update both the behavior and the user-visible help text.
- When adding new slash commands, update the definitions in `lib/constants.ts` and ensure the terminal/local handling still matches.

## Chat + Data Notes

- The current model is configured in `app/api/chat/route.ts` via `@ai-sdk/anthropic`.
- `app/api/chat/route.ts` hardcodes allowed origins. If a new domain, subdomain, or local port is introduced, update that list.
- Rate limiting is in-memory per process. Do not describe it as durable or shared across instances.
- GitHub data fetches use in-memory TTL caching in `lib/github.ts`. Preserve graceful degradation when GitHub requests fail.

## Editing Guidance

- Before changing framework behavior, read the relevant Next 16 docs in `node_modules/next/dist/docs/`.
- Prefer extending existing renderer/shell patterns over introducing parallel UI systems.
- If you touch icon behavior or metadata files, verify the generated browser icon surfaces still work with Next app file conventions.
- Favor concise, source-of-truth documentation over generic boilerplate.
