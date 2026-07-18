# CLAUDE.md

## Project

FlashNote (闪记) — AI-native note-taking tool. Two interfaces: **CLI** + **Desktop** (Electron). Both share `src/main/services/`.

## Quick Commands

```bash
pnpm dev              # Electron dev (HMR)
pnpm test             # vitest (56 tests)
pnpm build            # production build
pnpm typecheck        # tsc --noEmit all targets
pnpm rebuild          # electron-rebuild better-sqlite3
```

> Detailed setup instructions are in the `bootstrap-env` skill (run on fresh clones).

## Tech Stack

**Desktop**: Electron 42 + React 19 + TypeScript + electron-vite (Vite)
**Frontend**: React 19, Tailwind CSS v4, Zustand, React Router v7 (HashRouter)
**Storage**: better-sqlite3 (WAL, FTS5) + Markdown files (YAML frontmatter)
**AI**: Multi-provider — Anthropic SDK + OpenAI-compatible fetch (DeepSeek, Moonshot, Zhipu, custom)

## Architecture

- `src/shared/` — types, constants, IPC channel registry (shared by all targets)
- `src/main/services/` — core logic, no Electron deps. Paths use `os.homedir()`
- `src/main/ipc/` — Electron IPC handlers (Desktop only)
- `src/preload/` — contextBridge security boundary (Desktop only)
- `src/renderer/` — React UI (Desktop only)
- `src/cli/` — CLI commands
- Renderer never touches Node APIs directly. All I/O goes through IPC `window.electronAPI.*`

## Key Design Decisions

- **Typed content model**: `NoteType = 'apikey' | 'credential' | 'command' | 'bookmark' | 'text'` determines card display and primary action
- **cleanedContent ≠ rawInput**: Only the extracted payload is stored. "sk-xxx 这是我的key" → stored as "sk-xxx"
- **Heuristic first, AI refine**: sync heuristicParse classifies immediately; async AI parse refines later
- **Card wall over file list**: main UI is a typed card grid, not a file browser
- **API keys in plaintext**: local desktop app, same approach as Claude Code
- **One command bar for everything**: search, create, edit, delete all through `/` commands and natural language. Shared between MainView and Alt+Space (`docs/design/ai-command-bar.md`)

## Coding Conventions

### Log tags
Use `LOG_TAGS.X.Y` constants from `src/shared/logTags.ts` — never inline strings like `'cloud:service'`. Never `console.*` — always `logger.*`.

### String / enum constants
IPC channels → `IPC_CHANNELS.X`, config keys → `CONFIG_KEYS.X`. Shared enum values (states, types, phases) must be defined as `as const` objects (`CLOUD_STATUS`, `SYNC_PHASES`). Any string literal repeated 3+ times across files must be extracted to a constant.

### Component Style

```ts
import { type ReactElement, useState } from 'react'

interface Props {
  note: Note
  onUpdate?: (id: string, title: string, content: string) => void
}

export function ComponentName({ note, onUpdate }: Props): ReactElement {
  // ...
}
```

- Named function declarations with explicit `ReactElement` return type. Never `React.FC`.
- Props: `interface Props` or `interface ComponentNameProps`, defined in the same file above the component.
- Never `export default`. Always inline named exports.
- Reuse over rewrite — compose from existing components instead of creating standalone alternatives.

### File Naming

PascalCase for all component files: `TextCard.tsx`, `SearchBar.tsx`, `CardWall.tsx`.

### Import Order

Groups in order, blank line between groups, alphabetically within each group:

```
1. React / React hooks
2. Store imports
3. Local components
4. Library imports (lucide, …)
5. Shared types (type-only)
6. Local utilities / data (cn, i18n, hooks, …)
```

Use relative paths (`../../shared/types`), not the `@shared` alias (configured but unused).

### State Management

- **Zustand** for cross-component state: notes, tasks, search query, active category
- **useState** for ephemeral UI: editing mode, copy feedback, modal visibility, delete confirmation
- Stores use `interface StoreState` with both state fields and actions

### Error Handling

```ts
try {
  await window.electronAPI.notes.create({ content: trimmed })
} catch (err) {
  console.error('Failed to create note:', err)
  setIsSaving(false)  // reset UI state on failure
}
```

- try-catch wrapping async IPC calls, with `console.error` + state reset
- `ErrorBoundary` class component wraps the entire app (in `App.tsx`)

### Main Process

- **IPC**: `ipcMain.handle` + `safeHandler()` for every handler. Each feature exports a `register*Ipc(deps)` function, registered in `ipc/index.ts`.
- **Broadcast**: use `broadcast()` from `src/main/utils/broadcast.ts`. Never redefine it locally.
- **Services**: pure TypeScript, never import `electron`. Dependencies via constructor/parameters.
- **DB migrations**: standalone `applyMigration00N(database)` functions in `database/connection.ts`. Version tracked in `_schema_version` table. Add columns with `try { ALTER TABLE } catch { /* exists */ }`.

### Tailwind / CSS

- Inline Tailwind classes only. No component-level custom CSS.
- `cn()` from `lib/cn.ts` (clsx + tailwind-merge) for conditional classes
- Class ordering: layout → sizing → spacing → borders → background → text → transitions
- Cards: `rounded-2xl border border-border bg-card p-4 space-y-3 card-hover`
- Type badges: `text-[9px] px-1.5 py-0.5 rounded font-medium bg-type-*/10 text-type-*`

## Color Palette (v2 UI)

### Theme Tokens (Light)

| Token | HSL | Usage |
|-------|-----|-------|
| `--background` | `60 9% 98%` | Page (warm stone) |
| `--foreground` | `24 10% 10%` | Text |
| `--card` | `0 0% 100%` | Card background |
| `--primary` | `33 95% 53%` | Accent (amber) |
| `--muted` | `60 5% 96%` | Subtle bg |
| `--muted-foreground` | `25 5% 45%` | Secondary text |
| `--border` | `24 6% 89%` | Borders |

### Card Type Colors

| Type | HSL | Hex |
|------|-----|-----|
| API Key | `38 92% 50%` | `#F59E0B` |
| Command | `160 84% 39%` | `#10B981` |
| Credential | `0 84% 60%` | `#EF4444` |
| Bookmark | `217 91% 60%` | `#3B82F6` |
| Text | `258 90% 65%` | `#8B5CF6` |

## Typography (v2 UI)

Semantic type scale defined as `--text-*` tokens in `globals.css` `@theme`. **Use the named sizes — not `text-[Npx]` and not raw `text-xs/sm/base/lg`.**

### Size Scale

| Token | Class | px | Usage |
|-------|-------|----|-------|
| micro | `text-micro` | 10 | badges, dot labels |
| caption | `text-caption` | 11 | meta, secondary labels, hints |
| label | `text-label` | 12 | form field labels, small UI |
| body | `text-body` | 14 | default body / content |
| title | `text-title` | 16 | section & card titles |
| heading | `text-heading` | 18 | page / modal headings |

### Role → Style (size + weight + color, applied inline)

| Role | Classes |
|------|---------|
| Section title (settings section, card-wall group) | `text-body font-medium text-foreground` |
| Card title | `text-body font-medium` |
| Body / content | `text-body` |
| Field label | `text-label text-muted-foreground` |
| Meta / secondary / hint | `text-caption text-muted-foreground` |
| Badge / micro | `text-micro font-medium` |

### Icons (lucide `size` prop)

Inline: `12` (small) · `14` (default) · `16` (large). Empty-state illustrations: `40`. Avoid other values.

## I18n

- Renderer only (CLI stays English). Two languages: `zh-CN` (default), `en`.
- Translation files: `src/renderer/i18n/zh-CN.ts` and `en.ts`. Flat key-value, no nesting.
- Hook: `import { useT } from '../i18n'` → `const { t } = useT()` → `t('card.copy')`.
- Parameters: `t('time.minutesAgo', { n: 5 })` → `"5分钟前"` / `"5m ago"`.
- Time formatting: use `useFormatTime()` hook. Never write a local `formatTime` — it breaks i18n.
- Key naming: `category.thing` — e.g. `card.copy`, `search.placeholder`, `type.apikey`.
- New key: add to `zh-CN.ts` first (it defines the `Translations` type), then `en.ts`.
- Language persists in `config.json` → `language` field. Settings UI has a `LanguageSelector`.

## Git Convention

`<type>: <subject>` — English, imperative, no period, ≤ 72 chars.

| type | when |
|------|------|
| `feat` | new feature |
| `fix` | bug fix |
| `style` | UI / visual-only |
| `refactor` | code restructure |
| `chore` | tooling, deps, build |
| `docs` | documentation |

### Branch Naming

`<type>/<short-description>` — kebab-case, English, 2–4 words.

| Prefix | For | Example |
|--------|-----|---------|
| `feat/` | new feature | `feat/cloud-sync`, `feat/status-bar` |
| `fix/` | bug fix | `fix/window-resize`, `fix/ctrl-shortcut` |
| `refactor/` | code restructure | `refactor/card-components` |
| `style/` | UI / visual-only | `style/v2-typography` |
| `docs/` | documentation | `docs/readme`, `docs/screenshots` |
| `chore/` | tooling, deps, build | `chore/ci-workflow` |

**Workflow:** small changes → commit directly to `main`. Multi-day features → branch → merge back → delete branch. Tag every release with `v<version>`.
