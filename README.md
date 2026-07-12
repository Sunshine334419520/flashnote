<p align="center">
  <img src="assets/icons/v2/icon_dock_256x256.png" alt="FlashNote" width="80" height="80">
</p>

<h1 align="center">FlashNote</h1>

<p align="center">
  <strong>AI-native smart note-taking tool. Capture anything — AI classifies, tags, and organizes instantly.</strong>
</p>

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/version-0.1.0-blue" alt="Version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License"></a>
  <a href="README.zh-CN.md">中文</a>
</p>

<!-- TODO: Replace with actual screenshot -->
<p align="center">
  <img src="docs/screenshots/hero.png" alt="FlashNote QuickCapture" width="680">
</p>

---

## Why FlashNote

| | Traditional Notes | FlashNote |
|---|:---:|:---:|
| **Capture** | Open app → new note → type → tag manually | `Alt+Space` → type → done |
| **Organization** | Folders & tags by hand | AI classifies & tags automatically |
| **Retrieval** | Scroll through files | Type keywords → instant semantic search |
| **Data** | Locked in proprietary cloud | Plain Markdown + SQLite on your disk |

### Three Principles

- **Card Wall, not File List** — Every note becomes a typed card (API Key, Bookmark, Command, Credential, Text). The right action is one click away.
- **AI at the Core** — Natural language input is parsed into structured notes. Semantic search finds what you mean, not just what you typed.
- **Your Data, Your Disk** — Everything stored locally as Markdown files + SQLite. No cloud, no server, no account required.

---

## Features

### Alt+Space Quick Capture

Press `Alt+Space` anywhere — a Spotlight-like window appears. Type whatever you need:

```
"sk-abc123 my OpenAI key" → ✨ AI creates an API Key card
"docker compose down"     → 🔍 Instant search → Enter to copy
"https://react.dev"       → 🌐 Saved as a Bookmark
```

No `/` prefix, no mode switching. Just type and press Enter.

### Five Card Types, One Click to Act

| Type | Icon | Primary Action | Example |
|------|:---:|------|------|
| **API Key** | `🔑` | Copy key | OpenAI, DeepSeek keys |
| **Command** | `💻` | Copy command | docker, git, shell snippets |
| **Credential** | `🛡` | Copy password | Login credentials |
| **Bookmark** | `🌐` | Open URL | Documentation, articles |
| **Text** | `📝` | View | Meeting notes, ideas |

> Sensitive data supports show/hide toggle with a single click.

<!-- TODO: Replace with actual screenshot -->
![Card Wall](docs/screenshots/card-wall.png)

### AI Command Bar

In the main window, use `/` commands for precise control:

| Command | What it does |
|------|------|
| `/search docker compose` | AI semantic search across all notes |
| `/add sk-xxx my key` | AI parses and creates a typed note |
| `/delete old docker command` | AI locates the note → confirm → delete |
| `/edit openai key to production` | AI finds + previews changes → apply |

<!-- TODO: Replace with actual screenshot -->
![AI Command](docs/screenshots/ai-command.png)

### Multi-Provider AI

Configure your own AI service. All providers supported:

- **Anthropic** — Claude Haiku, Sonnet, Opus
- **OpenAI** — GPT-4o, GPT-4o-mini
- **DeepSeek** — deepseek-chat, deepseek-reasoner
- **Moonshot / Zhipu / Custom** — Any OpenAI-compatible endpoint

<!-- TODO: Replace with actual screenshot -->
![Settings](docs/screenshots/settings.png)

### AI Operation History

Every AI operation is recorded. Click `✦ AI` in the status bar to see what happened — and retry on failure.

<!-- TODO: Replace with actual screenshot -->
![Status Bar](docs/screenshots/status-bar.png)

---

## Quick Start

### Download

Go to [Releases](https://github.com/Sunshine334419520/flashnote/releases) and download the latest version for your platform:

- **macOS** — `FlashNote-0.x.x.dmg` (Apple Silicon & Intel)
- **Windows** — `FlashNote-0.x.x.exe`
- **Linux** — `FlashNote-0.x.x.AppImage`

> macOS: The app is not signed yet. Right-click → Open to bypass Gatekeeper on first launch.

### Development

```bash
# Prerequisites: Node ≥22, pnpm ≥10
git clone https://github.com/Sunshine334419520/flashnote.git
cd flashnote
pnpm install
pnpm dev          # Start dev (Electron + HMR)
pnpm test         # Run 56 tests
pnpm typecheck    # TypeScript check
```

Detailed setup: run `/bootstrap-env` after cloning.

---

## Tech Stack

| Layer | Technology |
|------|------|
| Desktop | Electron 42 |
| UI | React 19 + Tailwind CSS v4 + Zustand |
| Build | electron-vite (Vite) |
| Storage | better-sqlite3 (WAL, FTS5 · trigram) + Markdown files |
| AI | Anthropic SDK + OpenAI-compatible fetch |
| I18n | React Context (zh-CN / en) |

---

## License

MIT © FlashNote
