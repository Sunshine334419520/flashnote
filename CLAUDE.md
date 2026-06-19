# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FlashNote (闪记) is an AI-native desktop note-taking app. Users capture content by typing/pasting and optionally telling the AI what it is — the AI handles classification, tagging, titling, and storage. Users never manage files or folders manually.

## Tech Stack

- **Desktop**: Electron (v39+), frameless windows on all platforms
- **Language**: TypeScript strict mode, shared types between main/renderer
- **Package manager**: pnpm (required — workspace support, strict resolution)
- **Build**: electron-vite (Vite-based, HMR for renderer, fast rebuild for main)
- **Frontend**: React 19, Tailwind CSS v4, shadcn/ui, Zustand (with immer + devtools)
- **Index DB**: better-sqlite3 (synchronous API, WAL mode, FTS5 for full-text search)
- **Markdown**: gray-matter (frontmatter parse) + react-markdown (render)
- **AI**: @anthropic-ai/sdk, default model `claude-haiku-4-5` for classification
- **Virtual scrolling**: react-virtuoso (dynamic item heights)
- **Icons**: lucide-react
- **Testing**: vitest (unit), Playwright (e2e)

## Architecture

### Three-Process Electron Model

```
Main Process (Node.js, full OS access)
  ├── Window Manager — creates/manages BrowserWindows
  ├── Global Shortcuts — Alt+Space for quick capture
  ├── System Tray — background running, context menu
  ├── IPC Handlers — notes.ipc, ai.ipc, search.ipc, settings.ipc
  └── Services — StorageService, IndexService, AIService, ConfigService, SearchService

Preload Script (security boundary)
  └── contextBridge.exposeInMainWorld('electronAPI', { notes, ai, search, settings, window })

Renderer Process (Chromium, React 19)
  ├── MainWindow — 3-panel: Sidebar | NoteList | NoteDetail
  ├── QuickCaptureWindow — separate frameless floating window
  └── SettingsWindow — separate window
```

**Security**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. All IPC uses `ipcMain.handle`/`ipcRenderer.invoke` (request-response). No `send` for data.

### Data Flow: Note Capture

```
User hotkey → QuickCaptureWindow opens → user inputs content + hint → Enter
→ renderer calls window.electronAPI.notes.create({ content, sourceHint })
→ main: generate UUID → AI classify (cache check → Claude API if miss)
→ StorageService writes {uuid}.md (YAML frontmatter + body)
→ IndexService inserts into SQLite (notes, tags, note_tags, categories, FTS)
→ main pushes event:note-created → renderer appends to list
→ QuickCaptureWindow closes
```

### Storage Layout

```
~/FlashNote/
├── notes/{uuid}.md       # Markdown with YAML frontmatter (source of truth)
├── index.db              # SQLite: notes, tags, note_tags, categories, notes_fts
├── config.json           # App settings (NOT API keys — those go to system keychain)
├── ai-cache.db           # Classification cache keyed by SHA-256(content + hint)
└── logs/                 # electron-log, 7-day rotation
```

### Directory Structure

```
src/
├── main/          # Main process: index.ts, window.ts, tray.ts, shortcuts.ts
│   ├── ipc/       # IPC handlers per domain
│   ├── services/  # Business logic (storage, index, ai, search, config)
│   ├── database/  # SQLite connection, migrations, schema types
│   └── utils/     # paths, markdown (gray-matter), hash, logger
├── preload/       # contextBridge API exposure + argument validation
├── renderer/      # React app
│   ├── routes/    # MainView, QuickCapture, SettingsView
│   ├── components/# layout/, quick-capture/, notes/, categories/, search/, settings/, common/
│   ├── stores/    # Zustand: noteStore, uiStore, settingsStore
│   ├── hooks/     # useNotes, useAI, useSearch, useSettings, useIpcEvent
│   └── styles/    # Tailwind globals, theme CSS variables, markdown rendering
└── shared/        # Types, constants, IPC channel registry (single source of truth)
```

## Key Design Decisions

- **Dual storage**: Markdown files are the source of truth (portable, git-friendly). SQLite is a performance index that can be rebuilt from files.
- **AI is suggestive, not enforced**: AI classification populates defaults but user edits are respected and never overwritten.
- **Separate Quick Capture window**: Floating frameless `BrowserWindow`, not a React portal — enables independent show/hide without bringing the full app to front.
- **Haiku for classification**: `claude-haiku-4-5` is sufficient for categorization tasks. System prompt uses ephemeral caching. Content hash cache avoids duplicate API calls.
- **IPC channel registry**: `src/shared/ipc-channels.ts` is the single source of truth for all channel names. Both main and preload reference it. Renderer types derive from preload.

## Commands (after Phase 0 scaffolding)

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev (HMR for renderer, restart for main changes)
pnpm build            # Production build
pnpm typecheck        # TypeScript check across all tsconfigs
pnpm lint             # ESLint across src/
pnpm test             # Run vitest unit tests
pnpm test:single <f>  # Run a single test file
pnpm test:e2e         # Run Playwright e2e tests
pnpm package          # Package with electron-builder (macOS/Win/Linux)
```
