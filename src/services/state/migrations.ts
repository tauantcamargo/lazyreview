import type { Database } from 'sql.js'

// ---------------------------------------------------------------------------
// Migration types
// ---------------------------------------------------------------------------

export interface Migration {
  readonly version: number
  readonly description: string
  readonly up: string
}

// ---------------------------------------------------------------------------
// Migration definitions
// ---------------------------------------------------------------------------

export const migrations: readonly Migration[] = [
  {
    version: 1,
    description: 'Initial schema: create all tables',
    up: `
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS pr_read_state (
        key TEXT PRIMARY KEY,
        last_seen_at TEXT NOT NULL,
        pr_updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS viewed_files (
        key TEXT NOT NULL,
        file_path TEXT NOT NULL,
        viewed_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (key, file_path)
      );

      CREATE TABLE IF NOT EXISTS bookmarked_repos (
        owner TEXT NOT NULL,
        repo TEXT NOT NULL,
        added_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (owner, repo)
      );

      CREATE TABLE IF NOT EXISTS recent_repos (
        owner TEXT NOT NULL,
        repo TEXT NOT NULL,
        last_used TEXT NOT NULL,
        PRIMARY KEY (owner, repo)
      );

      CREATE TABLE IF NOT EXISTS pr_notes (
        key TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS review_checklists (
        key TEXT NOT NULL,
        item TEXT NOT NULL,
        checked INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (key, item)
      );

      CREATE TABLE IF NOT EXISTS diff_bookmarks (
        key TEXT NOT NULL,
        register TEXT NOT NULL,
        file_path TEXT NOT NULL,
        line_number INTEGER NOT NULL,
        label TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (key, register)
      );

      CREATE TABLE IF NOT EXISTS kv_store (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
]

// ---------------------------------------------------------------------------
// Migration runner
// ---------------------------------------------------------------------------

/**
 * Ensure the migrations table exists so we can track applied versions.
 */
function ensureMigrationsTable(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
}

/**
 * Get the set of already-applied migration versions.
 */
export function getAppliedVersions(db: Database): ReadonlySet<number> {
  const results = db.exec('SELECT version FROM migrations ORDER BY version')
  if (results.length === 0) return new Set<number>()

  const versions = new Set<number>()
  for (const row of results[0].values) {
    const version = row[0]
    if (typeof version === 'number') {
      versions.add(version)
    }
  }
  return versions
}

/**
 * Run all pending migrations in order.
 * Returns the number of migrations applied.
 */
export function runMigrations(db: Database): number {
  ensureMigrationsTable(db)

  const applied = getAppliedVersions(db)
  let count = 0

  const pending = migrations
    .filter((m) => !applied.has(m.version))
    .sort((a, b) => a.version - b.version)

  for (const migration of pending) {
    db.run('BEGIN TRANSACTION')
    try {
      db.run(migration.up)
      db.run(
        'INSERT INTO migrations (version, description) VALUES (?, ?)',
        [migration.version, migration.description],
      )
      db.run('COMMIT')
      count += 1
    } catch (error) {
      db.run('ROLLBACK')
      throw error
    }
  }

  return count
}

/**
 * Get the current schema version (highest applied migration).
 * Returns 0 if no migrations have been applied.
 */
export function getCurrentVersion(db: Database): number {
  const results = db.exec('SELECT MAX(version) FROM migrations')
  if (results.length === 0) return 0

  const maxVersion = results[0].values[0]?.[0]
  return typeof maxVersion === 'number' ? maxVersion : 0
}
