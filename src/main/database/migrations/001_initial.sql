-- FlashNote Schema v1
-- Notes table
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
);

-- Tags (normalized)
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    usage_count INTEGER NOT NULL DEFAULT 0
);

-- Note <-> Tags (many-to-many)
CREATE TABLE IF NOT EXISTS note_tags (
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    note_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

-- Settings KV store
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- FTS5 full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    title,
    content,
    tags,
    category,
    content='notes',
    content_rowid='rowid'
);

-- FTS sync triggers
CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts(rowid, title, content, tags, category)
    VALUES (new.rowid, new.title, '', '', new.category);
END;

CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, title, content, tags, category)
    VALUES ('delete', old.rowid, old.title, '', '', old.category);
END;

CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, title, content, tags, category)
    VALUES ('delete', old.rowid, old.title, '', '', old.category);
    INSERT INTO notes_fts(rowid, title, content, tags, category)
    VALUES (new.rowid, new.title, '', '', new.category);
END;
