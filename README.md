# richietan.dev

Claude Code-inspired personal website for Richie Tan, built as a browser-based terminal experience on Next.js 16.

## What It Does

- Recreates the feel of Claude Code in the browser, including a terminal-style transcript, prompt, shortcuts, slash commands, and local help surfaces.
- Answers questions about Richie using an Anthropic model through the Vercel AI SDK.
- Pulls live portfolio data from GitHub through tool calls for projects, skills, resume source, and profile stats.
- Includes a macOS-style desktop/window shell with a relaunch icon when the terminal window is closed or minimized.

## Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Vercel AI SDK (`ai`, `@ai-sdk/react`)
- Anthropic provider (`@ai-sdk/anthropic`)
- `marked` + `highlight.js` for terminal-style markdown rendering
- GitHub REST + GraphQL fetches for live portfolio data

## Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create or update `.env.local` with:

   ```bash
   ANTHROPIC_API_KEY=...
   GITHUB_TOKEN=... # optional but recommended
   ```

3. Start the app:

   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000`.

Useful scripts:

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Environment Variables

- `ANTHROPIC_API_KEY`
  Required. Used by `app/api/chat/route.ts` to stream model responses.
- `GITHUB_TOKEN`
  Optional but recommended. Enables GitHub GraphQL-backed features like pinned repos and contribution stats. Without it, some GitHub-derived data gracefully degrades.

## Architecture

### App shell

- `app/page.tsx`
  Dynamically loads the client-only shell.
- `components/home-shell.tsx`
  Composes the desktop, macOS-style window, and terminal.
- `components/desktop.tsx`
  Owns the desktop surface, snap preview, and relaunch icon.
- `components/mac-window.tsx`
  Handles window drag, resize, minimize, maximize, and close behavior.

### Terminal UI

- `components/terminal.tsx`
  Main state machine for chat, local history, reverse search, slash-command handling, and local panels.
- `components/message.tsx`
  Renders transcript rows.
- `components/input-area.tsx`
  Prompt, caret, footer, and shortcuts/help affordances.
- `components/markdown.tsx`
  Terminal-style markdown renderer tuned to match Claude Code behavior as closely as possible in the browser.

### Data + model layer

- `app/api/chat/route.ts`
  Streams chat responses, enforces origin allowlisting, and applies a simple in-memory per-IP rate limit.
- `lib/system-prompt.ts`
  System prompt for the Claude Code-style terminal persona.
- `lib/tools.ts`
  AI tool definitions exposed to the model.
- `lib/github.ts`
  GitHub fetch layer with in-memory TTL caching.
- `lib/transcript.ts`
  Normalizes model/tool output into UI transcript nodes.
- `lib/constants.ts`
  Header/footer text plus slash-command definitions.

## Slash Commands

Supported prompt commands:

- `/help`
- `/resume`
- `/projects`
- `/skills`
- `/contact`
- `/clear`

Prompt-style commands are transformed server-side into richer prompts before being sent to the model. Local commands are handled entirely in the client transcript flow.

## Operational Notes

- Allowed browser origins are hardcoded in `app/api/chat/route.ts`. If you add a new domain or preview host, update that list.
- Rate limiting is in-memory and resets on restart or redeploy.
- App/browser icons use Next.js app metadata file conventions from `app/`:
  - `app/favicon.ico`
  - `app/icon.png`
  - `app/apple-icon.png`
- The root page is intentionally client-rendered via dynamic import to avoid SSR issues with the desktop/window shell.

## Validation

Before shipping changes, run:

```bash
npm run lint
npm run build
```

There is no dedicated test suite yet; lint and production build are the current safety checks.
