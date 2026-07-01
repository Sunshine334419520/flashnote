import { mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { AIService } from '@services/ai'

/**
 * Env var checked to decide whether real-AI integration tests run.
 * Unset (CI, fresh clone) → gated tests skip, everything falls back to heuristic.
 * Set locally (`export FLASHNOTE_TEST_ANTHROPIC_KEY=sk-ant-...`) → gated tests
 * run against the real Anthropic API. Never committed (see .gitignore).
 */
export const FLASHNOTE_TEST_AI_KEY_ENV = 'FLASHNOTE_TEST_ANTHROPIC_KEY'
export const hasTestAIKey = !!process.env[FLASHNOTE_TEST_AI_KEY_ENV]

let storageCounter = 0

/**
 * Build an AIService backed by a fresh temp storage dir.
 * If FLASHNOTE_TEST_ANTHROPIC_KEY is set, inject an Anthropic provider so the
 * real AI parse path is exercised; otherwise the service has no provider and
 * AIService.parse falls back to heuristicParse (no network).
 */
export function createTestAIService(): AIService {
  // Avoid Date.now()/Math.random() — use a monotonic counter + pid for uniqueness.
  const storagePath = join(tmpdir(), `flashnote-ai-test-${process.pid}-${storageCounter++}`)
  mkdirSync(join(storagePath, 'notes'), { recursive: true })
  const ai = new AIService(storagePath)

  const key = process.env[FLASHNOTE_TEST_AI_KEY_ENV]
  if (key) {
    ai.addProvider({
      type: 'anthropic',
      name: 'Test Anthropic',
      apiKey: key,
      baseURL: 'https://api.anthropic.com',
      model: 'claude-haiku-4-5',
      maxTokens: 300
    })
  }
  return ai
}
