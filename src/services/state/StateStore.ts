import initSqlJs from 'sql.js'
import type { Database } from 'sql.js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { runMigrations } from './migrations'
import type {
  StateStore,
  StoredPRNote,
  StoredPRReadState,
  StoredViewedFile,
  StoredBookmarkedRepo,
  StoredRecentRepo,
  StoredDiffBookmark,
  StoredChecklistItem,
} from './types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RECENT_REPOS = 20

function getDefaultDbPath(): string {
  return join(homedir(), '.local', 'share', 'lazyreview', 'state.db')
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nowISO(): string {
  return new Date().toISOString()
}

// ---------------------------------------------------------------------------
// StateStore factory
// ---------------------------------------------------------------------------

/**
 * Create a file-backed StateStore at the given path (or default).
 * Call `open()` before using any methods.
 */
export function createStateStore(dbPath?: string): StateStore {
  const resolvedPath = dbPath ?? getDefaultDbPath()
  let db: Database | null = null

  function getDb(): Database {
    if (!db) {
      throw new Error('StateStore is not open. Call open() first.')
    }
    return db
  }

  async function saveToDisk(): Promise<void> {
    if (!db) return
    const data = db.export()
    const dir = resolvedPath.substring(0, resolvedPath.lastIndexOf('/'))
    await mkdir(dir, { recursive: true, mode: 0o700 })
    await writeFile(resolvedPath, Buffer.from(data), { mode: 0o600 })
  }

  return buildStoreFromInit({
    open: async () => {
      const SQL = await initSqlJs()
      try {
        const fileBuffer = await readFile(resolvedPath)
        db = new SQL.Database(fileBuffer)
      } catch {
        db = new SQL.Database()
      }
      runMigrations(db)
      await saveToDisk()
    },
    close: () => {
      if (db) {
        saveToDisk().catch(() => {
          // best-effort save on close
        })
        db.close()
        db = null
      }
    },
    getDb,
  })
}

/**
 * Create an in-memory StateStore for testing.
 * Does not persist to disk.
 */
export function createInMemoryStore(): StateStore {
  let db: Database | null = null

  function getDb(): Database {
    if (!db) {
      throw new Error('StateStore is not open. Call open() first.')
    }
    return db
  }

  return buildStoreFromInit({
    open: async () => {
      const SQL = await initSqlJs()
      db = new SQL.Database()
      runMigrations(db)
    },
    close: () => {
      if (db) {
        db.close()
        db = null
      }
    },
    getDb,
  })
}

// ---------------------------------------------------------------------------
// Shared store builder
// ---------------------------------------------------------------------------

interface StoreInit {
  readonly open: () => Promise<void>
  readonly close: () => void
  readonly getDb: () => Database
}

function buildStoreFromInit(init: StoreInit): StateStore {
  const { open, close, getDb } = init

  // -- PR notes ---------------------------------------------------------------

  function getPRNotes(key: string): StoredPRNote | undefined {
    const db = getDb()
    const results = db.exec(
      'SELECT key, content, created_at, updated_at FROM pr_notes WHERE key = ?',
      [key],
    )
    if (results.length === 0 || results[0].values.length === 0) return undefined

    const row = results[0].values[0]
    return {
      key: String(row[0]),
      content: String(row[1]),
      createdAt: String(row[2]),
      updatedAt: String(row[3]),
    }
  }

  function setPRNotes(key: string, content: string): void {
    const db = getDb()
    const now = nowISO()
    db.run(
      `INSERT INTO pr_notes (key, content, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET content = ?, updated_at = ?`,
      [key, content, now, now, content, now],
    )
  }

  function deletePRNotes(key: string): void {
    const db = getDb()
    db.run('DELETE FROM pr_notes WHERE key = ?', [key])
  }

  // -- Read state -------------------------------------------------------------

  function getReadState(key: string): StoredPRReadState | undefined {
    const db = getDb()
    const results = db.exec(
      'SELECT key, last_seen_at, pr_updated_at FROM pr_read_state WHERE key = ?',
      [key],
    )
    if (results.length === 0 || results[0].values.length === 0) return undefined

    const row = results[0].values[0]
    return {
      key: String(row[0]),
      lastSeenAt: String(row[1]),
      prUpdatedAt: String(row[2]),
    }
  }

  function setReadState(key: string, prUpdatedAt: string): void {
    const db = getDb()
    const now = nowISO()
    db.run(
      `INSERT INTO pr_read_state (key, last_seen_at, pr_updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET last_seen_at = ?, pr_updated_at = ?`,
      [key, now, prUpdatedAt, now, prUpdatedAt],
    )
  }

  // -- Viewed files -----------------------------------------------------------

  function getViewedFiles(key: string): readonly StoredViewedFile[] {
    const db = getDb()
    const results = db.exec(
      'SELECT key, file_path, viewed_at FROM viewed_files WHERE key = ? ORDER BY viewed_at',
      [key],
    )
    if (results.length === 0) return []

    return results[0].values.map((row) => ({
      key: String(row[0]),
      filePath: String(row[1]),
      viewedAt: String(row[2]),
    }))
  }

  function setViewedFile(key: string, filePath: string): void {
    const db = getDb()
    const now = nowISO()
    db.run(
      `INSERT OR REPLACE INTO viewed_files (key, file_path, viewed_at) VALUES (?, ?, ?)`,
      [key, filePath, now],
    )
  }

  function removeViewedFile(key: string, filePath: string): void {
    const db = getDb()
    db.run('DELETE FROM viewed_files WHERE key = ? AND file_path = ?', [key, filePath])
  }

  // -- Bookmarked repos -------------------------------------------------------

  function getBookmarkedRepos(): readonly StoredBookmarkedRepo[] {
    const db = getDb()
    const results = db.exec(
      'SELECT owner, repo, added_at FROM bookmarked_repos ORDER BY added_at',
    )
    if (results.length === 0) return []

    return results[0].values.map((row) => ({
      owner: String(row[0]),
      repo: String(row[1]),
      addedAt: String(row[2]),
    }))
  }

  function addBookmarkedRepo(owner: string, repo: string): void {
    const db = getDb()
    const now = nowISO()
    db.run(
      `INSERT OR IGNORE INTO bookmarked_repos (owner, repo, added_at) VALUES (?, ?, ?)`,
      [owner, repo, now],
    )
  }

  function removeBookmarkedRepo(owner: string, repo: string): void {
    const db = getDb()
    db.run('DELETE FROM bookmarked_repos WHERE owner = ? AND repo = ?', [owner, repo])
  }

  // -- Recent repos -----------------------------------------------------------

  function getRecentRepos(): readonly StoredRecentRepo[] {
    const db = getDb()
    const results = db.exec(
      'SELECT owner, repo, last_used FROM recent_repos ORDER BY last_used DESC',
    )
    if (results.length === 0) return []

    return results[0].values.map((row) => ({
      owner: String(row[0]),
      repo: String(row[1]),
      lastUsed: String(row[2]),
    }))
  }

  function addRecentRepo(owner: string, repo: string): void {
    const db = getDb()
    const now = nowISO()
    db.run(
      `INSERT INTO recent_repos (owner, repo, last_used)
       VALUES (?, ?, ?)
       ON CONFLICT(owner, repo) DO UPDATE SET last_used = ?`,
      [owner, repo, now, now],
    )

    // Prune old entries beyond MAX_RECENT_REPOS
    db.run(
      `DELETE FROM recent_repos WHERE rowid NOT IN (
        SELECT rowid FROM recent_repos ORDER BY last_used DESC LIMIT ?
      )`,
      [MAX_RECENT_REPOS],
    )
  }

  // -- Diff bookmarks ---------------------------------------------------------

  function getDiffBookmarks(key: string): readonly StoredDiffBookmark[] {
    const db = getDb()
    const results = db.exec(
      `SELECT key, register, file_path, line_number, label, created_at
       FROM diff_bookmarks WHERE key = ? ORDER BY register`,
      [key],
    )
    if (results.length === 0) return []

    return results[0].values.map((row) => ({
      key: String(row[0]),
      register: String(row[1]),
      filePath: String(row[2]),
      lineNumber: Number(row[3]),
      label: row[4] != null ? String(row[4]) : undefined,
      createdAt: String(row[5]),
    }))
  }

  function setDiffBookmark(
    key: string,
    bookmark: Omit<StoredDiffBookmark, 'key' | 'createdAt'>,
  ): void {
    const db = getDb()
    const now = nowISO()
    db.run(
      `INSERT INTO diff_bookmarks (key, register, file_path, line_number, label, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(key, register) DO UPDATE SET
         file_path = ?, line_number = ?, label = ?, created_at = ?`,
      [
        key,
        bookmark.register,
        bookmark.filePath,
        bookmark.lineNumber,
        bookmark.label ?? null,
        now,
        bookmark.filePath,
        bookmark.lineNumber,
        bookmark.label ?? null,
        now,
      ],
    )
  }

  function removeDiffBookmark(key: string, register: string): void {
    const db = getDb()
    db.run('DELETE FROM diff_bookmarks WHERE key = ? AND register = ?', [key, register])
  }

  // -- Review checklists ------------------------------------------------------

  function getChecklistState(key: string): readonly StoredChecklistItem[] {
    const db = getDb()
    const results = db.exec(
      `SELECT key, item, checked, updated_at
       FROM review_checklists WHERE key = ? ORDER BY item`,
      [key],
    )
    if (results.length === 0) return []

    return results[0].values.map((row) => ({
      key: String(row[0]),
      item: String(row[1]),
      checked: Number(row[2]) === 1,
      updatedAt: String(row[3]),
    }))
  }

  function setChecklistItem(key: string, item: string, checked: boolean): void {
    const db = getDb()
    const now = nowISO()
    db.run(
      `INSERT INTO review_checklists (key, item, checked, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(key, item) DO UPDATE SET checked = ?, updated_at = ?`,
      [key, item, checked ? 1 : 0, now, checked ? 1 : 0, now],
    )
  }

  // -- Key-value store --------------------------------------------------------

  function getKV(key: string): string | undefined {
    const db = getDb()
    const results = db.exec(
      'SELECT value FROM kv_store WHERE key = ?',
      [key],
    )
    if (results.length === 0 || results[0].values.length === 0) return undefined
    return String(results[0].values[0][0])
  }

  function setKVEntry(key: string, value: string): void {
    const db = getDb()
    const now = nowISO()
    db.run(
      `INSERT INTO kv_store (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?`,
      [key, value, now, value, now],
    )
  }

  function deleteKV(key: string): void {
    const db = getDb()
    db.run('DELETE FROM kv_store WHERE key = ?', [key])
  }

  // -- Build store ------------------------------------------------------------

  return {
    open,
    close,
    getPRNotes,
    setPRNotes,
    deletePRNotes,
    getReadState,
    setReadState,
    getViewedFiles,
    setViewedFile,
    removeViewedFile,
    getBookmarkedRepos,
    addBookmarkedRepo,
    removeBookmarkedRepo,
    getRecentRepos,
    addRecentRepo,
    getDiffBookmarks,
    setDiffBookmark,
    removeDiffBookmark,
    getChecklistState,
    setChecklistItem,
    getKV,
    setKV: setKVEntry,
    deleteKV,
  }
}
