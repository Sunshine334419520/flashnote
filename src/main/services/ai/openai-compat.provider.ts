import type { AIProvider } from './base'
import type { AIProviderConfig, SmartParseResult } from '../../../shared/types'
import { SMART_PARSE_SYSTEM_PROMPT, buildParseUserMessage } from './prompts'
import { extractJSON } from './anthropic.provider'

/**
 * OpenAI-compatible Chat Completions provider.
 * Covers: OpenAI, DeepSeek, Moonshot, Zhipu, and custom endpoints.
 * Uses raw fetch() — no extra dependencies.
 */
export class OpenAICompatibleProvider implements AIProvider {
  readonly config: AIProviderConfig

  constructor(config: AIProviderConfig) {
    this.config = config
  }

  async parse(rawInput: string): Promise<SmartParseResult> {
    const userMessage = buildParseUserMessage(rawInput)
    const url = `${this.config.baseURL}/chat/completions`

    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: 0.1,
      messages: [
        { role: 'system', content: SMART_PARSE_SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ],
      response_format: { type: 'json_object' }
    }

    // DeepSeek thinking mode
    if (this.config.thinking === 'enabled') {
      body.thinking = { type: 'enabled' }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      throw new Error(
        `AI API error: ${response.status} ${response.statusText}${errorBody ? ` — ${errorBody}` : ''}`
      )
    }

    const data = (await response.json()) as OpenAIResponse
    const contentText = data.choices?.[0]?.message?.content ?? ''
    return extractJSON(contentText)
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

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string } }>
  error?: { message: string; type: string }
}
