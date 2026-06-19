import type { AIProvider } from './base'
import type { AIProviderConfig, ClassificationResult } from '../../../shared/types'
import { CLASSIFICATION_SYSTEM_PROMPT, buildClassifyUserMessage } from './prompts'
import { extractJSON } from './anthropic.provider'

/**
 * OpenAI-compatible Chat Completions provider.
 * Covers: OpenAI, DeepSeek, Moonshot, Zhipu, and custom endpoints.
 *
 * Uses raw fetch() instead of the openai SDK to:
 * 1. Avoid adding another dependency
 * 2. Support any OpenAI-compatible API with custom baseURL
 */
export class OpenAICompatibleProvider implements AIProvider {
  readonly config: AIProviderConfig

  constructor(config: AIProviderConfig) {
    this.config = config
  }

  async classify(content: string, hint?: string): Promise<ClassificationResult> {
    const userMessage = buildClassifyUserMessage(content, hint)
    const url = `${this.config.baseURL}/chat/completions`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: 0.1,
        messages: [
          { role: 'system', content: CLASSIFICATION_SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ],
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      throw new Error(
        `AI API error: ${response.status} ${response.statusText}${errorBody ? ` — ${errorBody}` : ''}`
      )
    }

    const data = (await response.json()) as OpenAIResponse
    const content_text = data.choices?.[0]?.message?.content ?? ''
    return extractJSON(content_text)
  }

  async testConnection(): Promise<boolean> {
    try {
      const url = `${this.config.baseURL}/chat/completions`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: 5,
          messages: [{ role: 'user', content: 'Say OK' }]
        })
      })
      return response.ok
    } catch {
      return false
    }
  }
}

// ============================================================
// Response types
// ============================================================

interface OpenAIResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
  error?: {
    message: string
    type: string
  }
}
