const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "journal.db");

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
  }
  return db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS journal_entries (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      ambience    TEXT NOT NULL CHECK(ambience IN ('forest','ocean','mountain','desert','meadow')),
      text        TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS analysis_cache (
      id           TEXT PRIMARY KEY,
      entry_id     TEXT NOT NULL UNIQUE,
      emotion      TEXT NOT NULL,
      keywords     TEXT NOT NULL,   -- JSON array string
      summary      TEXT NOT NULL,
      analyzed_at  TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_entries_user ON journal_entries(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_cache_entry  ON analysis_cache(entry_id);
  `);
}

module.exports = { getDb };
