# Mewki

A task agenda with an AI assistant, the Mew. Type or speak a task in plain Portuguese and it lands
on the right day; ask the Mew to plan, move or break down your week, and confirm what she proposes.

- **Web:** [mewki.mxrqz.com](https://mewki.mxrqz.com)
- **Android:** the APK on the [latest release](https://github.com/mxrqz/Dailify/releases/latest)

## Features

- Agenda by day and month, recurring tasks, undated tasks, reminders (Web Push and Android alarms).
- The Mew: chat that reads your agenda and proposes changes behind a confirm box.
- Voice capture, and Mewki as Android's default digital assistant.
- Integrations: Google Calendar (two-way), Slack (the Mew reads and sends on request).
- Remote MCP server at `https://api.mewki.mxrqz.com/mcp`: connect Claude, ChatGPT or Gemini to your
  agenda over OAuth.
- Works offline; writes sync when the connection returns.

## Stack

| Part   | Path              | Tech                                                        |
| ------ | ----------------- | ----------------------------------------------------------- |
| Web    | `apps/web`        | React, Vite, Tailwind 4, shipped as a Tauri 2 Android app   |
| API    | `apps/server`     | Hono on Cloudflare Workers, D1, Better Auth, OpenAI, Stripe |
| Shared | `packages/shared` | The TypeScript model both apps compile                      |

## Develop

```bash
bun install
cp apps/web/.env.example apps/web/.env
cp apps/server/.env.example apps/server/.env
bun run dev     # API on :8787 + web on https://localhost:1420
bun run check   # format, lint, typecheck and tests in every package
```

Conventions and architecture: [`CLAUDE.md`](CLAUDE.md), [`RULES.md`](RULES.md) and the
`CLAUDE.md` in each folder.

Some package, database and storage names still say "dailify", the product's former name.
