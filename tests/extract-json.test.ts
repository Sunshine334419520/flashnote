import { describe, it, expect } from 'vitest'

// Import from the anthropic provider since extractJSON lives there
import { extractJSON } from '@utils/extract-json'

describe('extractJSON', () => {
  it('parses plain JSON', () => {
    const r = extractJSON('{"cleanedContent":"sk-xxx","type":"apikey","category":"API Keys","tags":["api-key"],"title":"Test","sensitive":true}')
    expect(r.type).toBe('apikey')
    expect(r.cleanedContent).toBe('sk-xxx')
    expect(r.sensitive).toBe(true)
    expect(r.tags).toEqual(['api-key'])
  })

  it('extracts JSON from markdown code fence', () => {
    const input = '```json\n{"cleanedContent":"docker run","type":"command","category":"Code Snippets","tags":["docker"],"title":"Docker Run","sensitive":false}\n```'
    const r = extractJSON(input)
    expect(r.type).toBe('command')
    expect(r.sensitive).toBe(false)
  })

  it('falls back gracefully on malformed JSON', () => {
    const r = extractJSON('not valid json at all {{{{')
    expect(r.type).toBe('text')
    expect(r.category).toBe('Other')
    expect(r.tags).toEqual([])
    expect(r.sensitive).toBe(false)
  })

  it('falls back on empty string', () => {
    const r = extractJSON('')
    expect(r.type).toBe('text')
    expect(r.title).toBe('Untitled Note')
  })

  it('handles missing fields with defaults', () => {
    const r = extractJSON('{"cleanedContent":"test"}')
    expect(r.cleanedContent).toBe('test')
    expect(r.type).toBe('text')
    expect(r.category).toBe('Other')
    expect(r.tags).toEqual([])
  })

  it('validates type field', () => {
    const r = extractJSON('{"type":"invalid_type","cleanedContent":"x","category":"Test","tags":[],"title":"T","sensitive":true}')
    expect(r.type).toBe('text') // invalid type falls back
  })
})
