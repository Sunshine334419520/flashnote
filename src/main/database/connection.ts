import Database from 'better-sqlite3'

let db: Database.Database | null = null

/**
 * Get or create the SQLite database connection.
 * Enables WAL mode for concurrent read performance.
 * Runs migrations on first open.
 */
export function getDatabase(dbPath?: string): Database.Database {
  if (db) return db

  if (!dbPath) throw new Error('Database not initialized. Call getDatabase(dbPath) first.')

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

  if (version < 1) {
    applyMigration001(database)
  }
  if (version < 2) {
    applyMigration002(database)
  }
  if (version < 3) {
    applyMigration003(database)
  }
  if (version < 4) {
    applyMigration004(database)
  }
  if (version < 5) {
    applyMigration005(database)
  }
  if (version < 6) {
    applyMigration006(database)
  }
  if (version < 7) {
    applyMigration007(database)
  }
  if (version < 8) {
    applyMigration008(database)
  }
  if (version < 9) {
    applyMigration009(database)
  }
}

function applyMigration001(database: Database.Database): void {
  // Notes table
  database.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'Other',
      source_hint TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
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

function applyMigration002(database: Database.Database): void {
  // Add status column to notes (for existing DBs that already have v1)
  try {
    database.exec(`ALTER TABLE notes ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'`)
  } catch {
    // Column already exists 閳?ignore
  }

  // Update all existing notes to 'published' (they predate the task system)
  database.prepare("UPDATE notes SET status = 'published' WHERE status = 'draft'").run()

  database.prepare('INSERT INTO _schema_version (version) VALUES (2)').run()
}

function applyMigration003(database: Database.Database): void {
  // Add type, sensitive, typed_data columns for typed content system
  try { database.exec(`ALTER TABLE notes ADD COLUMN type TEXT NOT NULL DEFAULT 'text'`) } catch { /* exists */ }
  try { database.exec(`ALTER TABLE notes ADD COLUMN sensitive INTEGER NOT NULL DEFAULT 0`) } catch { /* exists */ }
  try { database.exec(`ALTER TABLE notes ADD COLUMN typed_data TEXT`) } catch { /* exists */ }

  database.prepare('INSERT INTO _schema_version (version) VALUES (3)').run()
}

function applyMigration004(database: Database.Database): void {
  // Add content column to notes (previously only stored in .md files)
  try { database.exec(`ALTER TABLE notes ADD COLUMN content TEXT NOT NULL DEFAULT ''`) } catch { /* exists */ }
  database.prepare('INSERT INTO _schema_version (version) VALUES (4)').run()
}

function applyMigration005(database: Database.Database): void {
  // Rebuild notes_fts with the `trigram` tokenizer so search works for CJK
  // substrings (unicode61 indexed each CJK run as one token 閳?"闊偂鍞ょ拠? could not
  // match inside "闂冨啿鍘滈惃鍕煩娴犲€熺槈閸?) and for mixed Latin/CJK queries.
  database.exec(`DROP TRIGGER IF EXISTS notes_ai`)
  database.exec(`DROP TRIGGER IF EXISTS notes_ad`)
  database.exec(`DROP TRIGGER IF EXISTS notes_au`)
  database.exec(`DROP TABLE IF EXISTS notes_fts`)

  database.exec(`
    CREATE VIRTUAL TABLE notes_fts USING fts5(
      title,
      content,
      tags,
      category,
      content='notes',
      content_rowid='rowid',
      tokenize='trigram case_sensitive 0'
    )
  `)

  // Recreate the same sync triggers (they index title+category; full content/tags
  // are written by updateFtsContent() on insert/update).
  database.exec(`
    CREATE TRIGGER notes_ai AFTER INSERT ON notes BEGIN
      INSERT INTO notes_fts(rowid, title, content, tags, category)
      VALUES (new.rowid, new.title, '', '', new.category);
    END
  `)
  database.exec(`
    CREATE TRIGGER notes_ad AFTER DELETE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, title, content, tags, category)
      VALUES ('delete', old.rowid, old.title, '', '', old.category);
    END
  `)
  database.exec(`
    CREATE TRIGGER notes_au AFTER UPDATE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, title, content, tags, category)
      VALUES ('delete', old.rowid, old.title, '', '', old.category);
      INSERT INTO notes_fts(rowid, title, content, tags, category)
      VALUES (new.rowid, new.title, '', '', new.category);
    END
  `)

  // Repopulate the index from existing notes + their tags (content column holds
  // up to the 2000-char preview, which is plenty for search).
  database.exec(`
    INSERT INTO notes_fts(rowid, title, content, tags, category)
    SELECT
      n.rowid,
      n.title,
      n.content,
      COALESCE((SELECT group_concat(t.name, ' ') FROM note_tags nt JOIN tags t ON nt.tag_id = t.id WHERE nt.note_id = n.id), ''),
      n.category
    FROM notes n
  `)

  database.prepare('INSERT INTO _schema_version (version) VALUES (5)').run()
}

function applyMigration006(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS cloud_connections (
      id            TEXT PRIMARY KEY,
      service       TEXT NOT NULL,
      access_token  TEXT NOT NULL,
      workspace_id  TEXT,
      workspace_name TEXT,
      account_name  TEXT,
      account_email TEXT,
      database_id   TEXT,
      database_url  TEXT,
      last_sync_at  TEXT,
      status        TEXT NOT NULL DEFAULT 'disconnected',
      error         TEXT,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    )
  `)

  database.prepare('INSERT INTO _schema_version (version) VALUES (6)').run()
}

function applyMigration007(database: Database.Database): void {
  // Add sync_rev column for cloud sync version tracking
  try {
    database.exec(`ALTER TABLE notes ADD COLUMN sync_rev INTEGER NOT NULL DEFAULT 0`)
  } catch {
    // Column already exists 閳?ignore
  }

  database.prepare('INSERT INTO _schema_version (version) VALUES (7)').run()
}

function applyMigration008(database: Database.Database): void {
  // Add base_rev column for conflict detection in cloud sync
  try {
    database.exec(`ALTER TABLE notes ADD COLUMN base_rev INTEGER NOT NULL DEFAULT 0`)
  } catch {
    // Column already exists 閳?ignore
  }

  database.prepare('INSERT INTO _schema_version (version) VALUES (8)').run()
}

function applyMigration009(database: Database.Database): void {
	// Add refresh_token + token_expires_at for OAuth providers that expire
	// (OneNote / Microsoft Graph). Notion leaves them null.
	try {
		database.exec("ALTER TABLE cloud_connections ADD COLUMN refresh_token TEXT")
	} catch {
		// Column already exists 鈥?ignore
	}
	try {
		database.exec("ALTER TABLE cloud_connections ADD COLUMN token_expires_at TEXT")
	} catch {
		// Column already exists 鈥?ignore
	}

	database.prepare('INSERT INTO _schema_version (version) VALUES (9)').run()
}
