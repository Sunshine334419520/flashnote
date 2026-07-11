import type { AIProvider, AICompletionRequest, AICompletionResult } from './base'
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

  async parse(rawInput: string, signal?: AbortSignal): Promise<SmartParseResult> {
    const { content } = await this.chat(
      [
        { role: 'system', content: SMART_PARSE_SYSTEM_PROMPT },
        { role: 'user', content: buildParseUserMessage(rawInput) }
      ],
      { maxTokens: this.config.maxTokens, temperature: 0.1, json: true, signal }
    )
    return extractJSON(content)
  }

  async complete(req: AICompletionRequest): Promise<AICompletionResult> {
    return this.chat(
      [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user }
      ],
      { maxTokens: req.maxTokens ?? this.config.maxTokens, temperature: req.temperature ?? 0.1, json: req.json, signal: req.signal }
    )
  }

  /** Shared POST to /chat/completions. Returns the assistant message text + finish reason. */
  private async chat(
    messages: Array<{ role: string; content: string }>,
    opts: { maxTokens: number; temperature: number; json?: boolean; signal?: AbortSignal }
  ): Promise<AICompletionResult> {
    const url = `${this.config.baseURL}/chat/completions`

    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
      messages
    }
    if (opts.json) body.response_format = { type: 'json_object' }

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
      body: JSON.stringify(body),
      signal: opts.signal
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      throw new Error(
        `AI API error: ${response.status} ${response.statusText}${errorBody ? ` — ${errorBody}` : ''}`
      )
    }

    const data = (await response.json()) as OpenAIResponse
    return {
      content: data.choices?.[0]?.message?.content ?? '',
      finishReason: data.choices?.[0]?.finish_reason
    }
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
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>
  error?: { message: string; type: string }
}
