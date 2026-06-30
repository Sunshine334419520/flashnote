import { describe, it, expect } from 'vitest'
import { serializeNote, parseNote } from '@utils/markdown'
import type { Note } from '@shared/types'

const sampleNote: Note = {
  id: 'test-123',
  type: 'apikey',
  title: 'DeepSeek API Key',
  content: 'sk-a6110badef0540d180d8670619393b49',
  description: 'My DeepSeek API key for development',
  category: 'API Keys & Credentials',
  tags: ['deepseek', 'api-key'],
  sensitive: true,
  typedData: { prefix: 'sk-', service: 'deepseek' },
  metadata: {},
  createdAt: '2026-06-25T00:00:00.000Z',
  updatedAt: '2026-06-25T00:00:00.000Z',
  isClassified: true,
  isManuallyEdited: false,
  status: 'published'
}

describe('markdown serialize/parse round-trip', () => {
  it('serializes and parses back with all fields intact', () => {
    const serialized = serializeNote(sampleNote)
    expect(serialized).toContain('---')
    expect(serialized).toContain('id: test-123')
    expect(serialized).toContain('type: apikey')
    expect(serialized).toContain('sensitive: true')

    const parsed = parseNote(serialized)
    expect(parsed.id).toBe(sampleNote.id)
    expect(parsed.type).toBe(sampleNote.type)
    expect(parsed.title).toBe(sampleNote.title)
    expect(parsed.content).toBe(sampleNote.content)
    expect(parsed.category).toBe(sampleNote.category)
    expect(parsed.tags).toEqual(sampleNote.tags)
    expect(parsed.sensitive).toBe(true)
    expect(parsed.status).toBe('published')
  })

  it('handles notes without optional fields', () => {
    const minimal: Note = {
      ...sampleNote,
      description: undefined,
      sourceHint: undefined,
      typedData: undefined,
      sensitive: false,
      status: 'draft'
    }
    const serialized = serializeNote(minimal)
    const parsed = parseNote(serialized)
    expect(parsed.description).toBeUndefined()
    expect(parsed.sensitive).toBe(false)
    expect(parsed.status).toBe('draft')
  })

  it('handles multiline content', () => {
    const multiline: Note = {
      ...sampleNote,
      content: 'line1\nline2\nline3',
      type: 'command'
    }
    const serialized = serializeNote(multiline)
    const parsed = parseNote(serialized)
    expect(parsed.content).toBe('line1\nline2\nline3')
  })
})
