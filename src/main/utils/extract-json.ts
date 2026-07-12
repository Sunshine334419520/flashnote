import type { SmartParseResult } from '../../shared/types'

/**
 * Extract a structured SmartParseResult from AI response text.
 * Handles both fenced JSON blocks (```json ... ```) and raw JSON.
 * Falls back to a plain text note on parse failure.
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
      title: text.split(/\r?\n/)[0].slice(0, 80) || 'Untitled Note',
      sensitive: false,
      structuredData: undefined
    }
  }
}
