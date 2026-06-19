import Database from 'better-sqlite3'
import { join } from 'path'
import { hashContent } from '../../utils/hash'
import type { ClassificationResult } from '../../../shared/types'

/**
 * SQLite-backed classification cache.
 * Keyed by SHA-256(content + hint), shared across all AI providers.
 */
export class AICache {
  private db: Database.Database

  constructor(storagePath: string) {
    this.db = new Database(join(storagePath, 'ai-cache.db'))
    this.db.pragma('journal_mode = WAL')
    this.initSchema()
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS classification_cache (
        content_hash TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        tags TEXT NOT NULL,
        title TEXT NOT NULL,
        structured_data TEXT,
        created_at TEXT NOT NULL,
        hit_count INTEGER NOT NULL DEFAULT 1
      )
    `)
  }

  get(content: string, hint?: string): ClassificationResult | null {
    const hash = hashContent(content, hint)
    const row = this.db
      .prepare('SELECT * FROM classification_cache WHERE content_hash = ?')
      .get(hash) as CacheRow | undefined

    if (!row) return null

    // Increment hit count
    this.db
      .prepare('UPDATE classification_cache SET hit_count = hit_count + 1 WHERE content_hash = ?')
      .run(hash)

    return {
      category: row.category,
      tags: JSON.parse(row.tags),
      title: row.title,
      structuredData: row.structured_data ? JSON.parse(row.structured_data) : undefined
    }
  }

  set(content: string, hint: string | undefined, result: ClassificationResult): void {
    const hash = hashContent(content, hint)
    this.db
      .prepare(`
        INSERT OR REPLACE INTO classification_cache
        (content_hash, category, tags, title, structured_data, created_at, hit_count)
        VALUES (?, ?, ?, ?, ?, datetime('now'), 1)
      `)
      .run(
        hash,
        result.category,
        JSON.stringify(result.tags),
        result.title,
        result.structuredData ? JSON.stringify(result.structuredData) : null
      )
  }

  close(): void {
    this.db.close()
  }
}

interface CacheRow {
  content_hash: string
  category: string
  tags: string
  title: string
  structured_data: string | null
  created_at: string
  hit_count: number
}
