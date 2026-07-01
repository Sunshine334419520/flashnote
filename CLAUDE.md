# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FlashNote (闪记) is an AI-native note-taking tool. Users type natural language — the AI extracts the payload, classifies it, generates a title and tags, and saves it. Two interfaces: **CLI** (terminal) and **Desktop** (Electron). Both share the same service layer.

## Development Quick Start

```bash
pnpm install          # Install dependencies
pnpm test             # Run all 54 tests (unit + integration)
pnpm test -- tests/heuristic.test.ts  # Run a single test file

# CLI
cd cli && pnpm exec tsx --tsconfig cli/tsconfig.json src/index.ts capture "your note"
cd cli && pnpm exec tsx --tsconfig cli/tsconfig.json src/index.ts list
cd cli && pnpm exec tsx --tsconfig cli/tsconfig.json src/index.ts search "keyword"
cd cli && pnpm exec tsx --tsconfig cli/tsconfig.json src/index.ts show <short-id>

# Desktop
pnpm dev              # Start Electron dev (HMR for renderer)
pnpm build            # Production build
pnpm exec tsc --noEmit -p tsconfig.main.json    # Type check main
pnpm exec tsc --noEmit -p tsconfig.renderer.json
pnpm exec tsc --noEmit -p tsconfig.preload.json
```

## Tech Stack

- **CLI**: commander + tsx, Node.js, same services as Desktop
- **Desktop**: Electron + React 19 + TypeScript + electron-vite (Vite)
- **Frontend**: React 19, Tailwind CSS v4, Zustand
- **Storage**: better-sqlite3 (WAL, FTS5) + Markdown files (YAML frontmatter)
- **AI**: Multi-provider — Anthropic SDK + OpenAI-compatible fetch (DeepSeek, Moonshot, Zhipu, custom)
- **Testing**: vitest (30 unit + 24 integration = 54 total)
- **Package manager**: pnpm

## Architecture

### Shared Service Layer

`src/main/services/` is shared between CLI and Desktop. No Electron dependencies — all path resolution uses `os.homedir()`.

```
src/
├── shared/              # Types, constants, IPC channel registry
├── main/
│   ├── services/        # Core business logic (shared: CLI + Desktop)
│   │   ├── storage.service.ts    # Markdown file I/O + index sync
│   │   ├── index.service.ts     # SQLite CRUD + FTS5 full-text search
│   │   ├── ai/
│   │   │   ├── index.ts         # AIService: provider management + parse
│   │   │   ├── base.ts          # AIProvider interface + heuristicParse
│   │   │   ├── anthropic.provider.ts
│   │   │   ├── openai-compat.provider.ts  # Covers 5 provider types
│   │   │   ├── prompts.ts       # Smart Parse system prompt
│   │   │   └── cache.ts         # SHA-256 classification cache (SQLite)
│   │   ├── config.service.ts    # config.json read/write
│   │   └── task-manager.ts      # In-memory AI processing task queue
│   ├── database/        # SQLite connection, migrations (v4 latest)
│   ├── utils/           # paths, markdown (gray-matter), hash, logger, safeHandler
│   ├── ipc/             # Electron IPC handlers (DESKTOP ONLY)
│   ├── preload/         # contextBridge security boundary (DESKTOP ONLY)
│   └── renderer/        # React UI (DESKTOP ONLY)
├── cli/                 # CLI tool
│   └── src/commands/    # capture, list, show, search
└── tests/               # All tests
    ├── heuristic.test.ts       # 15 tests — type detection
    ├── extract-json.test.ts    # 6 tests — JSON parsing
    ├── markdown.test.ts        # 3 tests — serialization round-trip
    ├── task-manager.test.ts    # 6 tests — task queue
    └── cli-integration.test.ts # 24 tests — full CLI flow
```

### Data Model

```typescript
type NoteType = 'apikey' | 'credential' | 'command' | 'bookmark' | 'text'

interface Note {
  id: string; type: NoteType; title: string; content: string
  category: string; tags: string[]; sensitive: boolean
  typedData?: Record<string, unknown>  // type-specific structured data
  status: 'draft' | 'published'
  // ...timestamps, flags
}

interface SmartParseResult {
  cleanedContent: string; type: NoteType; category: string
  tags: string[]; title: string; sensitive: boolean
  typedData?: Record<string, unknown>
  appendToNoteId?: string  // @reference → append to existing note (not yet implemented)
}
```

### Storage Layout

```
~/FlashNote/
├── notes/{uuid}.md       # Markdown with YAML frontmatter (source of truth)
├── index.db              # SQLite: notes, tags, note_tags, categories, notes_fts, settings
├── ai-cache.db           # Parse cache keyed by SHA-256(rawInput)
├── config.json           # App settings
└── logs/                 # Daily rotation
```

### Note Capture Flow

```
User input: "sk-xxx 我的deepseek api key"
  │
  ├── heuristicParse (sync, ms-level) → type=apikey, category=API Keys, sensitive=true
  │
  ├── save as draft → write .md file + SQLite index (status='draft')
  │
  ├── AI parse (async background) → refine classification, generate title
  │
  ├── publish → status='published' → note appears in list/search
  │
  └── cleanedContent stored: "sk-xxx" (NOT raw input — meta-commentary discarded)
```

### Multi-Provider AI

| Provider Type | Implementation | API Format |
|---|---|---|
| anthropic | AnthropicProvider (SDK) | Messages API |
| openai, deepseek, moonshot, zhipu, custom | OpenAICompatibleProvider (fetch) | Chat Completions |

- No openai SDK dependency — uses raw `fetch()` for all OpenAI-compatible APIs
- DeepSeek thinking mode: `config.thinking = 'enabled'` adds `{"thinking": {"type": "enabled"}}` to request
- Fallback: if no active provider or API fails → heuristicParse handles it
- AI cache: SHA-256(rawInput) → skip duplicate API calls

## Key Design Decisions

- **Typed content model**: Notes have a `type` (apikey/credential/command/bookmark/text) that determines card display and primary action
- **cleanedContent vs rawInput**: Only the extracted payload is stored. "sk-xxx 这是我的key" → stored as "sk-xxx"
- **AI generates distinct titles**: Same topic (e.g., "OpenAI API Key") → AI adds context ("OpenAI API Key (开发环境)") to differentiate. Notes are NOT merged — each key is its own note with a distinguishable title.
- **Heuristic first, AI refine**: synchronous heuristicParse gives immediate classification; async AI parse refines it. User never waits.
- **Draft → Published flow**: Notes start as draft, appear in UI only after AI completes (or immediately if no AI configured). TaskBar shows processing status.
- **Card wall over file list**: Main UI is a CSS Grid of typed cards (APIKeyCard, CommandCard, etc.), not a file browser.
- **Content stored in SQLite + Markdown**: SQLite has the content (up to 2000 chars for preview). .md files are the full source of truth.
- **API keys stored in plaintext**: Local desktop app. Same approach as Claude Code.

## Testing

### 54 tests (5 files)

| File | Type | Count | Focus |
|------|------|-------|-------|
| `tests/heuristic.test.ts` | Unit | 15 | Type detection (apikey/credential/command/bookmark/text), sensitivity |
| `tests/extract-json.test.ts` | Unit | 6 | JSON parsing, markdown fences, fallback |
| `tests/markdown.test.ts` | Unit | 3 | Frontmatter serialize/parse round-trip |
| `tests/task-manager.test.ts` | Unit | 6 | Queue, markDone, markFailed, truncation |
| `tests/cli-integration.test.ts` | Integration | 24 | Full CLI flow: capture→search→list→show |

### Run tests

```bash
pnpm test                                          # All 54
pnpm test -- tests/cli-integration.test.ts         # Integration only
pnpm test:watch                                     # Watch mode
```

## Outstanding Work

See `docs/audit-2025-06-30.md` for the full audit (50 items). Key categories:

- **6 Bugs**: WINDOW_SHOW_MAIN misrouted, BookmarkCard Open broken, CLI capture no error handling, duplicate 'sk-' prefix, show.ts duplicate import, alert() for test results
- **11 Incomplete features**: @ append mechanism, content backfill, theme switching, general settings UI, content editing, new-note button, CLI delete/edit/config commands, card click action, delete confirmation
- **7 IPC issues**: Unused channels, un-broadcasted events, missing safeHandler wrappers, missing preload methods
- **12 Dead code**: AppShell, Sidebar, NoteListPanel, NoteCard, NoteDetailPanel, NoteContent, unused path functions, unused close functions, unused store methods
- **4 Test gaps**: Zero desktop UI tests, boundary cases, AI provider tests
- **10 Tech debt**: Cache no TTL, log rotation, CardWall no virtualization, N+1 tag queries, cross-dependency, path alias inconsistency, missing auto-update, CLI boilerplate, process.exit issues
