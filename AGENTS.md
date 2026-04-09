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
- `OPENAI_API_KEY` is required for automatic wallpaper generation.
- `BLOB_READ_WRITE_TOKEN` is required for the wallpaper pool stored in Vercel Blob.
- `CRON_SECRET` is required in production for the wallpaper cron route.
- `GITHUB_TOKEN` is optional but recommended for pinned repos and GitHub contribution stats.
- Never commit secrets or paste secret values into docs, code comments, or logs.

## Architecture Map

- `app/page.tsx`
  Server-rendered entrypoint that selects a wallpaper per request and mounts the client desktop shell directly.
- `components/home-shell.tsx`
  Top-level client desktop orchestrator. Wires launcher rect measurement to the generic desktop manager and renders one host per openable app window.
- `components/desktop.tsx`
  Transparent desktop surface, application launcher, and snap preview overlay.
- `components/desktop-window-host.tsx`
  Per-window host for a registered app. Owns snapshot refresh, genie transitions, and the live `MacWindow` handoff for exactly one window.
- `components/mac-window.tsx`
  Generic macOS-style window chrome: title bar, traffic lights, drag, resize, minimize, maximize, and close.
- `components/app-launcher.tsx`
  Registry-driven Spotlight-style launcher. It should not contain app-specific branching.
- `components/terminal.tsx`
  Claude app content only. Main interaction loop: prompt state, history, reverse search, slash commands, local help, and streaming transcript behavior.
- `components/markdown.tsx`
  Terminal-style markdown renderer. Avoid replacing it with generic markdown/bubble UI behavior.
- `app/api/chat/route.ts`
  Vercel AI SDK streaming route, origin allowlist, in-memory rate limiting, Anthropic model call.
- `lib/tools.ts` and `lib/github.ts`
  Tool definitions and live GitHub-backed data fetches.
- `lib/transcript.ts`
  Transcript normalization layer used by the terminal renderer.
- `lib/app-registry.tsx`
  Source of truth for desktop apps. App metadata, launcher entries, window defaults, titles, and optional opening snapshot renderers belong here.
- `lib/desktop-manager.ts`
  Generic multi-window reducer and geometry engine. Focus, z-order, drag, resize, snap, minimize, restore, close, and launch behavior belong here.
- `lib/window-snapshot-cache.ts`
  App-scoped local snapshot caching used by genie open/minimize/restore transitions.
- `lib/opening-window-snapshot.ts`
  Generated fallback/opening snapshot art for apps that opt into it.
- `lib/constants.ts`
  Claude app strings and slash commands. Keep shell-generic data out of this file.
- `lib/wallpapers.ts`
  Blob manifest, random wallpaper selection, and cron-driven image generation.

## Project Conventions

- Preserve the Claude Code-inspired UX unless the task explicitly changes it.
- The application launcher is the shared relaunch/restore affordance for desktop apps.
- Keep root app/browser icons in `app/` using Next metadata file conventions:
  - `app/favicon.ico`
  - `app/icon.png`
  - `app/apple-icon.png`
- Keep `app/page.tsx` server-rendered for wallpaper selection and request-time background work, but keep the interactive desktop shell client-side.
- When changing prompt/help/shortcut behavior, update both the behavior and the user-visible help text.
- When adding new slash commands, update the definitions in `lib/constants.ts` and ensure the terminal/local handling still matches.
- New apps should be added by extending `lib/app-registry.tsx`, not by hardcoding branches into `HomeShell`, `Desktop`, or `AppLauncher`.
- App content components should stay isolated from shell churn. Moving or focusing one window should not require rerendering unrelated app bodies.
- If an app wants genie transitions, give it an app-scoped snapshot path via `snapshotRenderer` and let `DesktopWindowHost` handle the generic orchestration.
- `MacWindow` should stay generic. Do not reintroduce Claude-specific title, styling, or behavior there.

## Chat + Data Notes

- The current model is configured in `app/api/chat/route.ts` via `@ai-sdk/anthropic`.
- `app/api/chat/route.ts` hardcodes allowed origins. If a new domain, subdomain, or local port is introduced, update that list.
- Rate limiting is in-memory per process. Do not describe it as durable or shared across instances.
- GitHub data fetches use in-memory TTL caching in `lib/github.ts`. Preserve graceful degradation when GitHub requests fail.
- Wallpaper backgrounds are selected server-side from Vercel Blob. Keep the desktop surface transparent so the background remains visible.
- Wallpaper generation is automatic via Vercel Cron; do not add a public admin UI or password form for it unless explicitly requested.

## Editing Guidance

- Before changing framework behavior, read the relevant Next 16 docs in `node_modules/next/dist/docs/`.
- Prefer extending existing renderer/shell patterns over introducing parallel UI systems.
- Treat `lib/app-registry.tsx` + `lib/desktop-manager.ts` + `components/desktop-window-host.tsx` as the shell architecture spine.
- Prefer scoped state updates and stable props over broad parent rerenders. Performance is a first-class requirement for the desktop shell.
- Keep snapshot/animation work lazy and per-window. Avoid global invalidation when only one window changes.
- If you touch icon behavior or metadata files, verify the generated browser icon surfaces still work with Next app file conventions.
- Favor concise, source-of-truth documentation over generic boilerplate.
