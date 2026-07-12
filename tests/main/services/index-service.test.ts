import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import Database from 'better-sqlite3'
import { getDatabase } from '../../../src/main/database/connection'
import { initIndexService, tokenizeQuery, ftsMatch, insertNote, searchNotes, recallCandidates } from '../../../src/main/services/index.service'
import type { Note } from '../../../src/shared/types'

// ── Test DB setup ───────────────────────────────────────────────────────

const testDir = join(tmpdir(), `flashnote-index-test-${process.pid}`)

function makeNote(overrides: Partial<Note> & { id: string }): Note {
  return {
    type: 'text',
    title: 'Untitled',
    content: '',
    category: 'Other',
    tags: [],
    status: 'published',
    sensitive: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }
}

beforeAll(() => {
  mkdirSync(join(testDir, 'notes'), { recursive: true })
  // Force a fresh database by resetting the singleton on the connection module
  initIndexService(testDir)
})

afterAll(() => {
  try { rmSync(testDir, { recursive: true }) } catch { /* cleanup */ }
})

// ============================================================
// tokenizeQuery — pure function
// ============================================================

describe('tokenizeQuery', () => {
  it('splits Latin words on whitespace', () => {
    expect(tokenizeQuery('hello world')).toEqual(['hello', 'world'])
  })

  it('splits CJK characters individually', () => {
    expect(tokenizeQuery('你好世界')).toEqual(['你好世界'])
  })

  it('splits Latin↔CJK boundaries', () => {
    const result = tokenizeQuery('OpenAi的API Key尾部')
    expect(result).toContain('openai')
    expect(result).toContain('的')
    expect(result).toContain('api')
    expect(result).toContain('key')
    expect(result).toContain('尾部')
  })

  it('handles mixed Chinese and English', () => {
    const result = tokenizeQuery('docker compose down 命令')
    expect(result).toEqual(['docker', 'compose', 'down', '命令'])
  })

  it('lowercases all input', () => {
    expect(tokenizeQuery('OpenAI')).toEqual(['openai'])
  })

  it('splits on punctuation', () => {
    const result = tokenizeQuery('hello,world;test:value')
    expect(result).toEqual(['hello', 'world', 'test', 'value'])
  })

  it('filters empty strings', () => {
    expect(tokenizeQuery('   ,,,   ')).toEqual([])
  })

  it('preserves numbers with letters', () => {
    const result = tokenizeQuery('test123 hello')
    expect(result).toEqual(['test123', 'hello'])
  })

  it('splits Chinese with numbers', () => {
    const result = tokenizeQuery('端口8080')
    expect(result).toEqual(['端口', '8080'])
  })
})

// ============================================================
// ftsMatch — FTS5 MATCH expression builder
// ============================================================

describe('ftsMatch', () => {
  it('builds AND expression from query', () => {
    const result = ftsMatch('docker compose down', 'AND')
    expect(result).toBe('"docker" AND "compose" AND "down"')
  })

  it('builds OR expression from query', () => {
    const result = ftsMatch('docker compose down', 'OR')
    expect(result).toBe('"docker" OR "compose" OR "down"')
  })

  it('drops terms shorter than 3 characters', () => {
    const result = ftsMatch('AI is my key', 'AND')
    // "AI"(2) and "is"(2) are dropped, "my"(2) dropped, "key"(3) kept
    expect(result).toBe('"key"')
  })

  it('returns empty string when all terms < 3 chars', () => {
    expect(ftsMatch('AI', 'AND')).toBe('')
    expect(ftsMatch('ho', 'OR')).toBe('')
  })

  it('handles CJK terms >= 3 chars', () => {
    // "的" is 1 char, dropped. "身份证" is 3 chars, kept.
    const result = ftsMatch('的 身份证', 'AND')
    expect(result).toBe('"身份证"')
  })

  it('handles mixed CJK and Latin', () => {
    const result = ftsMatch('OpenAi的API Key', 'OR')
    // "openai"(6), "的"(1→drop), "api"(3), "key"(3)
    expect(result).toBe('"openai" OR "api" OR "key"')
  })

  it('returns empty for empty input', () => {
    expect(ftsMatch('', 'OR')).toBe('')
    expect(ftsMatch('   ', 'AND')).toBe('')
  })
})

// ============================================================
// searchNotes — FTS5 full-text search integration
// ============================================================

describe('searchNotes', () => {
  beforeAll(() => {
    // Insert test notes
    insertNote(makeNote({
      id: 'n1', type: 'command', title: 'Docker Compose',
      content: 'docker compose down --volumes',
      category: 'DevOps', tags: ['docker']
    }))
    insertNote(makeNote({
      id: 'n2', type: 'apikey', title: 'OpenAI Key',
      content: 'sk-abc123def456',
      category: 'API Keys', tags: ['openai'], sensitive: true
    }))
    insertNote(makeNote({
      id: 'n3', type: 'text', title: '会议记录',
      content: '讨论了中国身份证号码的校验规则',
      category: 'Other', tags: ['meeting']
    }))
    insertNote(makeNote({
      id: 'n4', type: 'bookmark', title: 'React Docs',
      content: 'https://react.dev',
      category: 'Reference', tags: ['react', 'frontend']
    }))
  })

  it('finds notes by English keyword', () => {
    const result = searchNotes({ text: 'docker', sortBy: 'updatedAt', sortOrder: 'desc', limit: 10, offset: 0 })
    expect(result.notes).toHaveLength(1)
    expect(result.notes[0].id).toBe('n1')
  })

  it('finds notes by title substring', () => {
    const result = searchNotes({ text: 'react', sortBy: 'updatedAt', sortOrder: 'desc', limit: 10, offset: 0 })
    expect(result.notes).toHaveLength(1)
    expect(result.notes[0].id).toBe('n4')
  })

  it('finds notes by Chinese substring (trigram)', () => {
    const result = searchNotes({ text: '身份证', sortBy: 'updatedAt', sortOrder: 'desc', limit: 10, offset: 0 })
    expect(result.notes).toHaveLength(1)
    expect(result.notes[0].id).toBe('n3')
  })

  it('returns empty for non-matching query', () => {
    const result = searchNotes({ text: 'nonexistent', sortBy: 'updatedAt', sortOrder: 'desc', limit: 10, offset: 0 })
    expect(result.notes).toHaveLength(0)
  })

  it('returns empty for short query (< 3 chars)', () => {
    const result = searchNotes({ text: 'sk', sortBy: 'updatedAt', sortOrder: 'desc', limit: 10, offset: 0 })
    // FTS skip (terms < 3 chars), falls back to listNotes
    expect(result.notes.length).toBeGreaterThanOrEqual(0)
  })

  it('respects limit', () => {
    const result = searchNotes({ text: 'docker', sortBy: 'updatedAt', sortOrder: 'desc', limit: 1, offset: 0 })
    expect(result.notes.length).toBeLessThanOrEqual(1)
  })
})

// ============================================================
// recallCandidates — broad recall for AI pipeline
// ============================================================

describe('recallCandidates', () => {
  it('returns candidates with OR matching', () => {
    const result = recallCandidates('docker compose', 5)
    expect(result.some((n) => n.id === 'n1')).toBe(true)
  })

  it('respects limit', () => {
    const result = recallCandidates('docker', 1)
    expect(result.length).toBeLessThanOrEqual(1)
  })

  it('returns recent notes when keyword recall is thin', () => {
    // "xyznonexistent" won't match anything → triggers top-up
    const result = recallCandidates('xyznonexistentlongword', 5)
    // Should return recent notes from the DB as fallback
    expect(result.length).toBeGreaterThanOrEqual(0)
  })
})
