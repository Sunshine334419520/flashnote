# Tests

## Running

```bash
pnpm test                  # all tests
pnpm test -- tests/heuristic.test.ts   # one file
pnpm test:watch            # watch mode
```

## Layout

| File | Type | Needs AI key? |
|------|------|---------------|
| `heuristic.test.ts` | unit (pure fn) | no |
| `extract-json.test.ts` | unit (pure fn) | no |
| `markdown.test.ts` | unit (pure fn) | no |
| `task-manager.test.ts` | unit | no |
| `cli-integration.test.ts` | integration (spawns CLI) | no (heuristic fallback) |
| `ai-provider.test.ts` | integration (AIService) | only for the gated real-AI cases |

Without an AI key, every test runs off `heuristicParse` — the real
`AnthropicProvider.parse` / `OpenAICompatibleProvider.parse` paths are **not**
exercised. The `cli-integration.test.ts` suite spawns the CLI via `npx tsx`
with `shell: true` (OS default shell) so it works on Windows, macOS, and Linux.

## Optional: real AI integration tests

`ai-provider.test.ts` has gated cases that hit the real Anthropic API. They
`it.skip` by default. To run them locally:

```bash
export FLASHNOTE_TEST_ANTHROPIC_KEY=sk-ant-...   # macOS/Linux
set FLASHNOTE_TEST_ANTHROPIC_KEY=sk-ant-...      # Windows cmd
$env:FLASHNOTE_TEST_ANTHROPIC_KEY="sk-ant-..."   # PowerShell
pnpm test
```

- **CI must NOT set this var** — then gated cases skip and no network calls happen.
- The key is read from the environment only; it is never written to disk or
  committed (`.gitignore` covers `.env`).
- If the API call throws (bad key, network), `AIService.parse` falls back to
  `heuristicParse`, so a flaky network won't fail the suite — but a wrong-shape
  AI response could. Inspect `ai-cache.db` if results look cached.

## Known limitation

`getDatabase()` (`src/main/database/connection.ts`) is a module-level singleton.
Within one test process the first `AIService` constructed pins the DB path; a
second `AIService` with a different `storagePath` silently reuses the first DB.
`createTestAIService()` (in `helpers/ai-test.ts`) therefore uses a fresh path
per process, not per call, when the key is set. Heuristic-only tests don't
write providers, so they're unaffected.
