import Database from 'better-sqlite3'
import { join } from 'path'
import { hashContent } from '../../utils/hash'
import type { SmartParseResult } from '../../../shared/types'

export class AICache {
  private db: Database.Database

  constructor(storagePath: string) {
    this.db = new Database(join(storagePath, 'ai-cache.db'))
    this.db.pragma('journal_mode = WAL')
    this.initSchema()
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS parse_cache (
        content_hash TEXT PRIMARY KEY,
        cleaned_content TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'text',
        category TEXT NOT NULL,
        tags TEXT NOT NULL,
        title TEXT NOT NULL,
        sensitive INTEGER NOT NULL DEFAULT 0,
        typed_data TEXT,
        structured_data TEXT,
        created_at TEXT NOT NULL,
        hit_count INTEGER NOT NULL DEFAULT 1
      )
    `)
  }

  get(rawInput: string): SmartParseResult | null {
    const hash = hashContent(rawInput)
    const row = this.db
      .prepare('SELECT * FROM parse_cache WHERE content_hash = ?')
      .get(hash) as CacheRow | undefined

    if (!row) return null

    this.db
      .prepare('UPDATE parse_cache SET hit_count = hit_count + 1 WHERE content_hash = ?')
      .run(hash)

    return {
      cleanedContent: row.cleaned_content,
      type: (row.type as SmartParseResult['type']) ?? 'text',
      category: row.category,
      tags: JSON.parse(row.tags),
      title: row.title,
      sensitive: row.sensitive === 1,
      typedData: row.typed_data ? JSON.parse(row.typed_data) : undefined,
      structuredData: row.structured_data ? JSON.parse(row.structured_data) : undefined
    }
  }

  set(rawInput: string, result: SmartParseResult): void {
    const hash = hashContent(rawInput)
    this.db
      .prepare(`
        INSERT OR REPLACE INTO parse_cache
        (content_hash, cleaned_content, type, category, tags, title, sensitive, typed_data, structured_data, created_at, hit_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 1)
      `)
      .run(
        hash,
        result.cleanedContent,
        result.type,
        result.category,
        JSON.stringify(result.tags),
        result.title,
        result.sensitive ? 1 : 0,
        result.typedData ? JSON.stringify(result.typedData) : null,
        result.structuredData ? JSON.stringify(result.structuredData) : null
      )
  }

  close(): void {
    this.db.close()
  }
}

interface CacheRow {
  content_hash: string
  cleaned_content: string
  type: string
  category: string
  tags: string
  title: string
  sensitive: number
  typed_data: string | null
  structured_data: string | null
  created_at: string
  hit_count: number
}
