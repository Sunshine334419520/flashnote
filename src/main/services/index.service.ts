import Database from 'better-sqlite3'
import { getDatabase } from '../database/connection'
import { hashFileContent } from '../utils/hash'
import { join } from 'path'
import { AI_COMMAND } from '../../shared/constants'
import type { Note } from '../../shared/types'
import type { SearchQuery, SearchResult } from '../../shared/types'
import type { NoteRow } from '../database/schema'

// ============================================================
// Module state
// ============================================================

let db: Database.Database | null = null
let storageRoot: string | null = null

export function initIndexService(storagePath: string): void {
  storageRoot = storagePath
  db = getDatabase(join(storagePath, 'index.db'))
}

function getDB(): Database.Database {
  if (!db) throw new Error('IndexService not initialized. Call initIndexService() first.')
  return db
}

// ============================================================
// Query tokenization (for the trigram FTS index)
// ============================================================

/**
 * Split a search string into FTS terms: lowercase, then break on whitespace,
 * punctuation, and Latin↔CJK boundaries. Keeps Latin words and CJK runs whole —
 * the trigram tokenizer handles substring matching within each.
 * e.g. "OpenAi的API Key尾部" → ["openai","的","api","key","尾部"]
 */
export function tokenizeQuery(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/([a-z0-9])([一-鿿])/g, '$1 $2')
    .replace(/([一-鿿])([a-z0-9])/g, '$1 $2')
    .split(/[^a-z0-9一-鿿]+/)
    .filter(Boolean)
}

/**
 * Build an FTS5 MATCH expression from a query. Terms shorter than 3 chars are
 * dropped (the trigram tokenizer needs ≥3 chars to form a trigram). Returns ''
 * when nothing is searchable. `op` joins terms: 'OR' for broad recall (candidate
 * generation), 'AND' for precise search.
 */
export function ftsMatch(text: string, op: 'AND' | 'OR'): string {
  return tokenizeQuery(text)
    .filter((t) => t.length >= 3)
    .map((t) => `"${t}"`)
    .join(` ${op} `)
}

// ============================================================
// Notes CRUD
// ============================================================

export function insertNote(note: Note): void {
  const db = getDB()
  const contentHash = hashFileContent(note.content)
  const wordCount = note.content.split(/\s+/).filter(Boolean).length

  const contentPreview = note.content.length > 2000 ? note.content.slice(0, 2000) : note.content

  db.prepare(`
    INSERT INTO notes (id, type, title, content, category, source_hint, status, sensitive, typed_data, created_at, updated_at, is_classified, is_manually_edited, content_hash, word_count, sync_rev)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    note.id,
    note.type,
    note.title,
    contentPreview,
    note.category,
    note.sourceHint ?? null,
    note.status,
    note.sensitive ? 1 : 0,
    note.typedData ? JSON.stringify(note.typedData) : null,
    note.createdAt,
    note.updatedAt,
    note.isClassified ? 1 : 0,
    note.isManuallyEdited ? 1 : 0,
    contentHash,
    wordCount,
    note.syncRev ?? 0
  )

  // Update FTS index with content text
  updateFtsContent(note.id, note.title, note.content, note.tags, note.category)

  // Upsert category
  upsertCategory(note.category, 1)

  // Link tags
  syncNoteTags(note.id, note.tags)
}

export function updateNote(note: Note): void {
  const db = getDB()
  const oldNote = getNoteById(note.id)
  if (!oldNote) throw new Error(`Note not found: ${note.id}`)

  const contentHash = hashFileContent(note.content)
  const wordCount = note.content.split(/\s+/).filter(Boolean).length

  const contentPreview = note.content.length > 2000 ? note.content.slice(0, 2000) : note.content

  db.prepare(`
    UPDATE notes SET
      type = ?, title = ?, content = ?, category = ?, source_hint = ?, status = ?, sensitive = ?, typed_data = ?, updated_at = ?,
      is_classified = ?, is_manually_edited = ?, content_hash = ?, word_count = ?, sync_rev = ?
    WHERE id = ?
  `).run(
    note.type,
    note.title,
    contentPreview,
    note.category,
    note.sourceHint ?? null,
    note.status,
    note.sensitive ? 1 : 0,
    note.typedData ? JSON.stringify(note.typedData) : null,
    note.updatedAt,
    note.isClassified ? 1 : 0,
    note.isManuallyEdited ? 1 : 0,
    contentHash,
    wordCount,
    note.syncRev ?? 0,
    note.id
  )

  // Update FTS
  updateFtsContent(note.id, note.title, note.content, note.tags, note.category)

  // Update category counts if category changed
  if (oldNote.category !== note.category) {
    upsertCategory(oldNote.category, -1)
    upsertCategory(note.category, 1)
  }

  // Re-sync tags
  syncNoteTags(note.id, note.tags)
}

export function deleteNoteById(noteId: string): void {
  const db = getDB()
  const note = getNoteById(noteId)
  if (!note) return

  // Decrement category count
  upsertCategory(note.category, -1)

  // Clean up tags
  clearNoteTags(noteId)

  // Delete from notes (FTS trigger handles FTS cleanup)
  db.prepare('DELETE FROM notes WHERE id = ?').run(noteId)
}

export function getNoteById(noteId: string): NoteRow | null {
  const db = getDB()
  const row = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId) as NoteRow | undefined
  return row ?? null
}

export function listNotes(query?: SearchQuery): SearchResult {
  const db = getDB()
  const limit = query?.limit ?? 50
  const offset = query?.offset ?? 0
  const sortBy = query?.sortBy ?? 'createdAt'
  const sortOrder = query?.sortOrder ?? 'desc'

  const sortColumn = sortBy === 'title' ? 'title' : sortBy === 'updatedAt' ? 'updated_at' : 'created_at'
  const order = sortOrder === 'asc' ? 'ASC' : 'DESC'

  let sql = "SELECT * FROM notes WHERE status = 'published'"
  const conditions: string[] = []
  const params: unknown[] = []

  if (query?.category) {
    conditions.push('category = ?')
    params.push(query.category)
  }

  if (query?.tags && query.tags.length > 0) {
    const placeholders = query.tags.map(() => '?').join(',')
    conditions.push(`
      id IN (SELECT note_id FROM note_tags nt JOIN tags t ON nt.tag_id = t.id WHERE t.name IN (${placeholders}))
    `)
    params.push(...query.tags)
  }

  if (conditions.length > 0) {
    sql += ' AND ' + conditions.join(' AND ')
  }

  // Count total
  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total')
  const { total } = db.prepare(countSql).get(...params) as { total: number }

  sql += ` ORDER BY ${sortColumn} ${order} LIMIT ? OFFSET ?`
  params.push(limit, offset)

  const rows = db.prepare(sql).all(...params) as NoteRow[]

  return {
    notes: rows.map(rowToNote),
    total,
    hasMore: offset + limit < total
  }
}

// ============================================================
// Tags
// ============================================================

function upsertTag(name: string): number {
  const db = getDB()
  const normalized = name.toLowerCase().trim()

  const existing = db.prepare('SELECT id FROM tags WHERE name = ?').get(normalized) as
    | { id: number }
    | undefined

  if (existing) {
    db.prepare('UPDATE tags SET usage_count = usage_count + 1 WHERE id = ?').run(existing.id)
    return existing.id
  }

  const result = db.prepare('INSERT INTO tags (name, usage_count) VALUES (?, 1)').run(normalized)
  return Number(result.lastInsertRowid)
}

function syncNoteTags(noteId: string, tags: string[]): void {
  clearNoteTags(noteId)

  for (const tag of tags) {
    const tagId = upsertTag(tag)
    const db = getDB()
    db.prepare('INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)').run(noteId, tagId)
  }
}

function clearNoteTags(noteId: string): void {
  const db = getDB()
  // Decrement usage counts for existing tags
  const existingTags = db.prepare(
    'SELECT tag_id FROM note_tags WHERE note_id = ?'
  ).all(noteId) as { tag_id: number }[]

  for (const { tag_id } of existingTags) {
    db.prepare(
      'UPDATE tags SET usage_count = MAX(0, usage_count - 1) WHERE id = ?'
    ).run(tag_id)
  }

  db.prepare('DELETE FROM note_tags WHERE note_id = ?').run(noteId)

  // Clean up unused tags
  db.prepare('DELETE FROM tags WHERE usage_count = 0').run()
}

// ============================================================
// Categories
// ============================================================

function upsertCategory(name: string, delta: number): void {
  const db = getDB()

  const existing = db.prepare('SELECT id, note_count FROM categories WHERE name = ?').get(name) as
    | { id: number; note_count: number }
    | undefined

  if (existing) {
    db.prepare('UPDATE categories SET note_count = MAX(0, note_count + ?) WHERE id = ?').run(
      delta,
      existing.id
    )
  } else if (delta > 0) {
    db.prepare(
      'INSERT INTO categories (name, note_count, created_at) VALUES (?, ?, ?)'
    ).run(name, delta, new Date().toISOString())
  }
}

// ============================================================
// FTS5 Full-Text Search
// ============================================================

function updateFtsContent(
  noteId: string,
  title: string,
  content: string,
  tags: string[],
  category: string
): void {
  const db = getDB()
  const row = db.prepare('SELECT rowid FROM notes WHERE id = ?').get(noteId) as
    | { rowid: number }
    | undefined
  if (!row) return

  const tagsStr = tags.join(' ')

  // Delete old FTS entry, insert new one with full content
  db.prepare("INSERT INTO notes_fts(notes_fts, rowid, title, content, tags, category) VALUES ('delete', ?, ?, '', '', ?)")
    .run(row.rowid, title, category)

  db.prepare(
    'INSERT INTO notes_fts(rowid, title, content, tags, category) VALUES (?, ?, ?, ?, ?)'
  ).run(row.rowid, title, content, tagsStr, category)
}

export function searchNotes(query: SearchQuery): SearchResult {
  const db = getDB()
  const limit = query.limit ?? 50
  const offset = query.offset ?? 0

  if (!query.text || query.text.trim().length === 0) {
    return listNotes(query)
  }

  // Trigram FTS: AND-join terms for a precise search (candidate recall uses OR).
  const match = ftsMatch(query.text, 'AND')
  if (!match) {
    return listNotes(query)
  }

  const countResult = db
    .prepare(
      `SELECT COUNT(*) as total FROM notes_fts WHERE notes_fts MATCH ?`
    )
    .get(match) as { total: number }

  const rows = db
    .prepare(
      `SELECT n.* FROM notes n
       JOIN notes_fts fts ON n.rowid = fts.rowid
       WHERE notes_fts MATCH ?
       ORDER BY rank
       LIMIT ? OFFSET ?`
    )
    .all(match, limit, offset) as NoteRow[]

  return {
    notes: rows.map(rowToNote),
    total: countResult.total,
    hasMore: offset + limit < countResult.total
  }
}

/**
 * Broad candidate recall for AI semantic search / locate. Unlike searchNotes
 * (strict AND), this OR-matches terms for high recall, then tops up with recent
 * published notes when the keyword hit set is thin (semantic queries may share
 * few literal words). The LLM reranks/filters the returned set downstream.
 */
export function recallCandidates(text: string, limit: number): Note[] {
  const db = getDB()
  const match = ftsMatch(text, 'OR')

  const rows: NoteRow[] = []
  const seen = new Set<string>()

  if (match) {
    const hits = db
      .prepare(
        `SELECT n.* FROM notes n
         JOIN notes_fts fts ON n.rowid = fts.rowid
         WHERE notes_fts MATCH ? AND n.status = 'published'
         ORDER BY rank
         LIMIT ?`
      )
      .all(match, limit) as NoteRow[]
    for (const r of hits) {
      rows.push(r)
      seen.add(r.id)
    }
  }

  // Top up with recent notes when keyword recall is thin.
  if (rows.length < AI_COMMAND.RECALL_TOPUP_THRESHOLD) {
    const recent = db
      .prepare("SELECT * FROM notes WHERE status = 'published' ORDER BY updated_at DESC LIMIT ?")
      .all(limit) as NoteRow[]
    for (const r of recent) {
      if (rows.length >= limit) break
      if (!seen.has(r.id)) {
        rows.push(r)
        seen.add(r.id)
      }
    }
  }

  return rows.map(rowToNote)
}

function rowToNote(row: NoteRow): Note {
  const db = getDB()
  const tagRows = db
    .prepare(
      `SELECT t.name FROM tags t
       JOIN note_tags nt ON t.id = nt.tag_id
       WHERE nt.note_id = ?`
    )
    .all(row.id) as { name: string }[]

  return {
    id: row.id,
    type: (row.type as Note['type']) ?? 'text',
    title: row.title,
    content: row.content ?? '',
    category: row.category,
    tags: tagRows.map((t) => t.name),
    sourceHint: row.source_hint ?? undefined,
    metadata: {},
    sensitive: row.sensitive === 1,
    typedData: row.typed_data ? JSON.parse(row.typed_data) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isClassified: row.is_classified === 1,
    isManuallyEdited: row.is_manually_edited === 1,
    status: (row.status as 'draft' | 'published') ?? 'draft',
    syncRev: row.sync_rev ?? 0
  }
}
