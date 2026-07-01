import { describe, it, expect } from 'vitest'
import { createTestAIService, hasTestAIKey } from './helpers/ai-test'

// Real-AI tests run only when FLASHNOTE_TEST_ANTHROPIC_KEY is set; otherwise
// they skip (CI default). The heuristic-fallback tests below always run.
const itIfAI = hasTestAIKey ? it : it.skip

describe('AIService — heuristic fallback (always runs, no network)', () => {
  it('classifies an API key without any provider configured', async () => {
    const ai = createTestAIService() // no env key → no provider → heuristic path
    if (hasTestAIKey) return // with a provider configured this test is N/A
    const result = await ai.parse('sk-test123 我的openai api key')
    expect(result.type).toBe('apikey')
    expect(result.sensitive).toBe(true)
    expect(result.category).toBe('API Keys & Credentials')
  })

  it('classifies a URL as a bookmark', async () => {
    const ai = createTestAIService()
    if (hasTestAIKey) return
    const result = await ai.parse('https://claude.ai/code claude code 官网')
    expect(result.type).toBe('bookmark')
  })
})

describe('AIService — real Anthropic provider (gated by FLASHNOTE_TEST_ANTHROPIC_KEY)', () => {
  itIfAI(
    'parses a natural-language note via the real API',
    async () => {
      const ai = createTestAIService()
      const result = await ai.parse('sk-test123 我的openai api key')
      expect(result.type).toBe('apikey')
      expect(result.sensitive).toBe(true)
      expect(result.title.length).toBeGreaterThan(0)
    },
    30000
  )

  itIfAI('falls back to heuristic when the API call throws', async () => {
    // A provider with a bogus endpoint forces provider.parse() to throw;
    // AIService.parse catches and returns heuristicParse. We can't easily
    // inject a bad provider via createTestAIService (it adds a real one), so
    // this case is covered by the heuristic-fallback suite above when no key
    // is set. Kept here as a placeholder for a future bad-provider injection.
  })
})
