import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import initSqlJs from 'sql.js'
import type { Database } from 'sql.js'
import {
  migrations,
  runMigrations,
  getAppliedVersions,
  getCurrentVersion,
} from '../migrations'

describe('migrations', () => {
  let db: Database

  beforeEach(async () => {
    const SQL = await initSqlJs()
    db = new SQL.Database()
  })

  afterEach(() => {
    db.close()
  })

  describe('migration definitions', () => {
    it('should have at least one migration', () => {
      expect(migrations.length).toBeGreaterThanOrEqual(1)
    })

    it('should have unique version numbers', () => {
      const versions = migrations.map((m) => m.version)
      const unique = new Set(versions)
      expect(unique.size).toBe(versions.length)
    })

    it('should have sequential version numbers starting from 1', () => {
      const sorted = [...migrations].sort((a, b) => a.version - b.version)
      sorted.forEach((m, i) => {
        expect(m.version).toBe(i + 1)
      })
    })

    it('should have non-empty descriptions', () => {
      for (const m of migrations) {
        expect(m.description.length).toBeGreaterThan(0)
      }
    })

    it('should have non-empty up SQL', () => {
      for (const m of migrations) {
        expect(m.up.trim().length).toBeGreaterThan(0)
      }
    })
  })

  describe('runMigrations', () => {
    it('should run all migrations on a fresh database', () => {
      const count = runMigrations(db)
      expect(count).toBe(migrations.length)
    })

    it('should create the migrations table', () => {
      runMigrations(db)
      const results = db.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'",
      )
      expect(results.length).toBe(1)
      expect(results[0].values.length).toBe(1)
    })

    it('should create all expected tables', () => {
      runMigrations(db)
      const expectedTables = [
        'migrations',
        'pr_read_state',
        'viewed_files',
        'bookmarked_repos',
        'recent_repos',
        'pr_notes',
        'review_checklists',
        'diff_bookmarks',
        'kv_store',
      ]

      const results = db.exec(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      )
      const tables = results[0].values.map((row) => String(row[0]))

      for (const table of expectedTables) {
        expect(tables).toContain(table)
      }
    })

    it('should record applied migrations in the migrations table', () => {
      runMigrations(db)
      const results = db.exec('SELECT version, description FROM migrations ORDER BY version')
      expect(results.length).toBe(1)
      expect(results[0].values.length).toBe(migrations.length)

      for (let i = 0; i < migrations.length; i++) {
        expect(results[0].values[i][0]).toBe(migrations[i].version)
        expect(results[0].values[i][1]).toBe(migrations[i].description)
      }
    })

    it('should be idempotent -- running twice applies nothing the second time', () => {
      const firstCount = runMigrations(db)
      expect(firstCount).toBe(migrations.length)

      const secondCount = runMigrations(db)
      expect(secondCount).toBe(0)
    })

    it('should only run pending migrations', () => {
      // Manually create migrations table and mark version 1 as applied
      db.run(`
        CREATE TABLE IF NOT EXISTS migrations (
          version INTEGER PRIMARY KEY,
          description TEXT NOT NULL,
          applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `)
      db.run(
        "INSERT INTO migrations (version, description) VALUES (1, 'Manual')",
      )

      // Now run migrations -- it should skip version 1
      // But it will fail because the tables from migration 1 don't exist yet
      // This is expected behavior: we only skip already-applied migrations
      const count = runMigrations(db)
      expect(count).toBe(0)
    })
  })

  describe('getAppliedVersions', () => {
    it('should return empty set on fresh database', () => {
      // Create the migrations table first
      db.run(`
        CREATE TABLE IF NOT EXISTS migrations (
          version INTEGER PRIMARY KEY,
          description TEXT NOT NULL,
          applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `)
      const versions = getAppliedVersions(db)
      expect(versions.size).toBe(0)
    })

    it('should return applied versions after running migrations', () => {
      runMigrations(db)
      const versions = getAppliedVersions(db)
      expect(versions.size).toBe(migrations.length)
      for (const m of migrations) {
        expect(versions.has(m.version)).toBe(true)
      }
    })
  })

  describe('getCurrentVersion', () => {
    it('should return 0 on fresh database', () => {
      db.run(`
        CREATE TABLE IF NOT EXISTS migrations (
          version INTEGER PRIMARY KEY,
          description TEXT NOT NULL,
          applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `)
      const version = getCurrentVersion(db)
      expect(version).toBe(0)
    })

    it('should return highest version after running migrations', () => {
      runMigrations(db)
      const version = getCurrentVersion(db)
      const maxVersion = Math.max(...migrations.map((m) => m.version))
      expect(version).toBe(maxVersion)
    })
  })

  describe('table schemas', () => {
    beforeEach(() => {
      runMigrations(db)
    })

    it('should have correct pr_read_state schema', () => {
      db.run(
        "INSERT INTO pr_read_state (key, last_seen_at, pr_updated_at) VALUES ('test', '2025-01-01', '2025-01-01')",
      )
      const results = db.exec('SELECT * FROM pr_read_state')
      expect(results[0].columns).toEqual(['key', 'last_seen_at', 'pr_updated_at'])
    })

    it('should have correct viewed_files schema with composite key', () => {
      db.run(
        "INSERT INTO viewed_files (key, file_path) VALUES ('pr:1', 'src/foo.ts')",
      )
      // Duplicate should fail due to composite primary key
      expect(() => {
        db.run(
          "INSERT INTO viewed_files (key, file_path) VALUES ('pr:1', 'src/foo.ts')",
        )
      }).toThrow()
    })

    it('should have correct bookmarked_repos schema with composite key', () => {
      db.run(
        "INSERT INTO bookmarked_repos (owner, repo) VALUES ('user', 'repo')",
      )
      expect(() => {
        db.run(
          "INSERT INTO bookmarked_repos (owner, repo) VALUES ('user', 'repo')",
        )
      }).toThrow()
    })

    it('should have correct recent_repos schema', () => {
      db.run(
        "INSERT INTO recent_repos (owner, repo, last_used) VALUES ('user', 'repo', '2025-01-01')",
      )
      const results = db.exec('SELECT * FROM recent_repos')
      expect(results[0].columns).toEqual(['owner', 'repo', 'last_used'])
    })

    it('should have correct pr_notes schema', () => {
      db.run(
        "INSERT INTO pr_notes (key, content) VALUES ('pr:1', 'my notes')",
      )
      const results = db.exec('SELECT * FROM pr_notes')
      expect(results[0].columns).toEqual(['key', 'content', 'created_at', 'updated_at'])
    })

    it('should have correct review_checklists schema with composite key', () => {
      db.run(
        "INSERT INTO review_checklists (key, item, checked) VALUES ('pr:1', 'check types', 1)",
      )
      expect(() => {
        db.run(
          "INSERT INTO review_checklists (key, item, checked) VALUES ('pr:1', 'check types', 0)",
        )
      }).toThrow()
    })

    it('should have correct diff_bookmarks schema', () => {
      db.run(
        "INSERT INTO diff_bookmarks (key, register, file_path, line_number) VALUES ('pr:1', 'a', 'src/foo.ts', 42)",
      )
      const results = db.exec('SELECT * FROM diff_bookmarks')
      expect(results[0].columns).toEqual([
        'key',
        'register',
        'file_path',
        'line_number',
        'label',
        'created_at',
      ])
    })

    it('should have correct kv_store schema', () => {
      db.run(
        "INSERT INTO kv_store (key, value) VALUES ('setting', 'value')",
      )
      const results = db.exec('SELECT * FROM kv_store')
      expect(results[0].columns).toEqual(['key', 'value', 'updated_at'])
    })
  })
})
