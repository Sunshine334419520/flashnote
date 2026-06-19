import Anthropic from '@anthropic-ai/sdk'
import type { AIProvider } from './base'
import type { AIProviderConfig, ClassificationResult } from '../../../shared/types'
import { CLASSIFICATION_SYSTEM_PROMPT, buildClassifyUserMessage } from './prompts'

export class AnthropicProvider implements AIProvider {
  readonly config: AIProviderConfig
  private client: Anthropic

  constructor(config: AIProviderConfig) {
    this.config = config
    this.client = new Anthropic({ apiKey: config.apiKey })
  }

  async classify(content: string, hint?: string): Promise<ClassificationResult> {
    const userMessage = buildClassifyUserMessage(content, hint)

    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      system: [
        {
          type: 'text',
          text: CLASSIFICATION_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' } as never
        }
      ],
      messages: [{ role: 'user', content: userMessage }]
    })

    return this.parseResponse(response)
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: this.config.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Reply with just: OK' }]
      })
      return true
    } catch {
      return false
    }
  }

  private parseResponse(response: Anthropic.Messages.Message): ClassificationResult {
    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    )

    if (!textBlock) {
      throw new Error('No text in Anthropic response')
    }

    return extractJSON(textBlock.text)
  }
}

/**
 * Extract JSON from a string that may be wrapped in markdown code fences.
 */
export function extractJSON(text: string): ClassificationResult {
  // Try to find JSON inside markdown code fence
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = jsonMatch ? jsonMatch[1].trim() : text.trim()

  try {
    const parsed = JSON.parse(raw)
    return {
      category: typeof parsed.category === 'string' ? parsed.category : 'Other',
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5).map(String) : [],
      title: typeof parsed.title === 'string' ? parsed.title : 'Untitled Note',
      structuredData:
        typeof parsed.structuredData === 'object' && parsed.structuredData !== null
          ? parsed.structuredData
          : undefined
    }
  } catch {
    // Fallback: use the first line as title
    return {
      category: 'Other',
      tags: [],
      title: text.split('\n')[0].slice(0, 80) || 'Untitled Note',
      structuredData: undefined
    }
  }
}
