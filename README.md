# FlashNote 闪记

AI-native smart note-taking desktop app. Capture notes by typing or pasting — AI handles classification, tagging, and organization automatically.

## Tech Stack

- **Desktop**: Electron + React 19 + TypeScript
- **Build**: electron-vite (Vite)
- **UI**: Tailwind CSS v4, Zustand
- **Storage**: Markdown (YAML frontmatter) + SQLite (FTS5 search)
- **AI**: Multi-provider support (Anthropic, OpenAI, DeepSeek, Moonshot, Zhipu, custom)

## Development

```bash
pnpm install        # Install dependencies
pnpm dev            # Start dev mode
pnpm build          # Production build
pnpm typecheck      # TypeScript check
```
