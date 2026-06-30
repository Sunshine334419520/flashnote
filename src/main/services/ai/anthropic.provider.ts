import Anthropic from '@anthropic-ai/sdk'
import type { AIProvider } from './base'
import type { AIProviderConfig, SmartParseResult } from '../../../shared/types'
import { SMART_PARSE_SYSTEM_PROMPT, buildParseUserMessage } from './prompts'

export class AnthropicProvider implements AIProvider {
  readonly config: AIProviderConfig
  private client: Anthropic

  constructor(config: AIProviderConfig) {
    this.config = config
    this.client = new Anthropic({ apiKey: config.apiKey })
  }

  async parse(rawInput: string): Promise<SmartParseResult> {
    const userMessage = buildParseUserMessage(rawInput)

    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      system: [
        {
          type: 'text',
          text: SMART_PARSE_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' } as never
        }
      ],
      messages: [{ role: 'user', content: userMessage }]
    })

    return this.extractResult(response)
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

  private extractResult(response: Anthropic.Messages.Message): SmartParseResult {
    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    )
    if (!textBlock) throw new Error('No text in Anthropic response')
    return extractJSON(textBlock.text)
  }
}

/**
 * Extract SmartParseResult from raw JSON string (may be wrapped in markdown fences).
 */
export function extractJSON(text: string): SmartParseResult {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = jsonMatch ? jsonMatch[1].trim() : text.trim()

  try {
    const parsed = JSON.parse(raw)
    return {
      cleanedContent: typeof parsed.cleanedContent === 'string' ? parsed.cleanedContent : text.slice(0, 200),
      type: ['apikey', 'credential', 'command', 'bookmark', 'text'].includes(parsed.type) ? parsed.type : 'text',
      category: typeof parsed.category === 'string' ? parsed.category : 'Other',
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5).map(String) : [],
      title: typeof parsed.title === 'string' ? parsed.title : 'Untitled Note',
      sensitive: parsed.sensitive === true,
      typedData: typeof parsed.typedData === 'object' && parsed.typedData !== null ? parsed.typedData : undefined,
      structuredData: typeof parsed.structuredData === 'object' && parsed.structuredData !== null ? parsed.structuredData : undefined,
      appendToNoteId: typeof parsed.appendToNoteId === 'string' ? parsed.appendToNoteId : undefined
    }
  } catch {
    return {
      cleanedContent: text.slice(0, 500),
      type: 'text',
      category: 'Other',
      tags: [],
      title: text.split('\n')[0].slice(0, 80) || 'Untitled Note',
      sensitive: false,
      structuredData: undefined
    }
  }
}
