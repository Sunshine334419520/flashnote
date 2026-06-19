import Database from 'better-sqlite3'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

let db: Database.Database | null = null

/**
 * Get or create the SQLite database connection.
 * Enables WAL mode for concurrent read performance.
 * Runs migrations on first open.
 */
export function getDatabase(dbPath: string): Database.Database {
  if (db) return db

  db = new Database(dbPath)

  // Performance: WAL mode for better concurrent reads
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')

  runMigrations(db)

  return db
}

/**
 * Close the database connection gracefully.
 */
export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

// ============================================================
// Migration runner
// ============================================================

function runMigrations(database: Database.Database): void {
  // Create schema version tracking table if not exists
  database.exec(`
    CREATE TABLE IF NOT EXISTS _schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  const currentVersion = database.prepare(
    'SELECT MAX(version) as version FROM _schema_version'
  ).get() as { version: number | null }

  const version = currentVersion?.version ?? 0

  // Load and apply migration files in order
  const migrationsDir = join(app.getAppPath(), 'src/main/database/migrations')

  // For production (ASAR), migrations are embedded in the JS bundle
  // We use inline SQL for the initial migration
  if (version < 1) {
    applyMigration001(database)
  }
}

function applyMigration001(database: Database.Database): void {
  // Notes table
  database.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Other',
      source_hint TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      is_classified INTEGER NOT NULL DEFAULT 0,
      is_manually_edited INTEGER NOT NULL DEFAULT 0,
      content_hash TEXT NOT NULL,
      word_count INTEGER NOT NULL DEFAULT 0
    )
  `)

  // Tags table
  database.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      usage_count INTEGER NOT NULL DEFAULT 0
    )
  `)

  // Note <-> Tags join table
  database.exec(`
    CREATE TABLE IF NOT EXISTS note_tags (
      note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (note_id, tag_id)
    )
  `)

  // Categories table
  database.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      note_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `)

  // Settings KV store
  database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  // FTS5 full-text search index (content-sync table)
  database.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
      title,
      content,
      tags,
      category,
      content='notes',
      content_rowid='rowid'
    )
  `)

  // Triggers to keep FTS in sync
  database.exec(`
    CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
      INSERT INTO notes_fts(rowid, title, content, tags, category)
      VALUES (new.rowid, new.title, '', '', new.category);
    END
  `)

  database.exec(`
    CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, title, content, tags, category)
      VALUES ('delete', old.rowid, old.title, '', '', old.category);
    END
  `)

  database.exec(`
    CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, title, content, tags, category)
      VALUES ('delete', old.rowid, old.title, '', '', old.category);
      INSERT INTO notes_fts(rowid, title, content, tags, category)
      VALUES (new.rowid, new.title, '', '', new.category);
    END
  `)

  // Mark migration as applied
  database.prepare('INSERT INTO _schema_version (version) VALUES (1)').run()
}
