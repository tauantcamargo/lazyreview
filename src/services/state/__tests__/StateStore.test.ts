import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createInMemoryStore } from '../StateStore'
import { buildPRKey, buildRepoKey } from '../types'
import type { StateStore } from '../types'

describe('StateStore', () => {
  let store: StateStore

  beforeEach(async () => {
    store = createInMemoryStore()
    await store.open()
  })

  afterEach(() => {
    store.close()
  })

  describe('lifecycle', () => {
    it('should open without errors', async () => {
      const s = createInMemoryStore()
      await expect(s.open()).resolves.toBeUndefined()
      s.close()
    })

    it('should close without errors', async () => {
      const s = createInMemoryStore()
      await s.open()
      expect(() => s.close()).not.toThrow()
    })

    it('should throw when accessing store before open', () => {
      const s = createInMemoryStore()
      expect(() => s.getKV('test')).toThrow('StateStore is not open')
    })

    it('should throw after close', async () => {
      const s = createInMemoryStore()
      await s.open()
      s.close()
      expect(() => s.getKV('test')).toThrow('StateStore is not open')
    })
  })

  describe('PR notes', () => {
    const key = 'github:owner/repo#1'

    it('should return undefined for non-existent note', () => {
      const note = store.getPRNotes(key)
      expect(note).toBeUndefined()
    })

    it('should set and get a note', () => {
      store.setPRNotes(key, 'my review notes')
      const note = store.getPRNotes(key)
      expect(note).toBeDefined()
      expect(note?.key).toBe(key)
      expect(note?.content).toBe('my review notes')
      expect(note?.createdAt).toBeDefined()
      expect(note?.updatedAt).toBeDefined()
    })

    it('should update an existing note', () => {
      store.setPRNotes(key, 'original')
      const original = store.getPRNotes(key)

      store.setPRNotes(key, 'updated')
      const updated = store.getPRNotes(key)

      expect(updated?.content).toBe('updated')
      expect(updated?.key).toBe(original?.key)
    })

    it('should delete a note', () => {
      store.setPRNotes(key, 'to delete')
      expect(store.getPRNotes(key)).toBeDefined()

      store.deletePRNotes(key)
      expect(store.getPRNotes(key)).toBeUndefined()
    })

    it('should not throw when deleting non-existent note', () => {
      expect(() => store.deletePRNotes('nonexistent')).not.toThrow()
    })

    it('should scope notes by key', () => {
      const key1 = 'github:owner/repo#1'
      const key2 = 'github:owner/repo#2'

      store.setPRNotes(key1, 'notes for PR 1')
      store.setPRNotes(key2, 'notes for PR 2')

      expect(store.getPRNotes(key1)?.content).toBe('notes for PR 1')
      expect(store.getPRNotes(key2)?.content).toBe('notes for PR 2')
    })
  })

  describe('read state', () => {
    const key = 'github:owner/repo#1'

    it('should return undefined for non-existent read state', () => {
      expect(store.getReadState(key)).toBeUndefined()
    })

    it('should set and get read state', () => {
      store.setReadState(key, '2025-01-15T00:00:00Z')
      const state = store.getReadState(key)
      expect(state).toBeDefined()
      expect(state?.key).toBe(key)
      expect(state?.prUpdatedAt).toBe('2025-01-15T00:00:00Z')
      expect(state?.lastSeenAt).toBeDefined()
    })

    it('should update read state', () => {
      store.setReadState(key, '2025-01-15T00:00:00Z')
      store.setReadState(key, '2025-01-16T00:00:00Z')

      const state = store.getReadState(key)
      expect(state?.prUpdatedAt).toBe('2025-01-16T00:00:00Z')
    })

    it('should scope by key', () => {
      const key1 = 'github:owner/repo#1'
      const key2 = 'gitlab:owner/repo#1'

      store.setReadState(key1, '2025-01-15T00:00:00Z')
      store.setReadState(key2, '2025-01-16T00:00:00Z')

      expect(store.getReadState(key1)?.prUpdatedAt).toBe('2025-01-15T00:00:00Z')
      expect(store.getReadState(key2)?.prUpdatedAt).toBe('2025-01-16T00:00:00Z')
    })
  })

  describe('viewed files', () => {
    const key = 'github:owner/repo#1'

    it('should return empty array for no viewed files', () => {
      expect(store.getViewedFiles(key)).toEqual([])
    })

    it('should add a viewed file', () => {
      store.setViewedFile(key, 'src/foo.ts')
      const files = store.getViewedFiles(key)
      expect(files).toHaveLength(1)
      expect(files[0].filePath).toBe('src/foo.ts')
      expect(files[0].key).toBe(key)
    })

    it('should add multiple viewed files', () => {
      store.setViewedFile(key, 'src/foo.ts')
      store.setViewedFile(key, 'src/bar.ts')
      const files = store.getViewedFiles(key)
      expect(files).toHaveLength(2)
    })

    it('should handle re-marking a file as viewed (upsert)', () => {
      store.setViewedFile(key, 'src/foo.ts')
      store.setViewedFile(key, 'src/foo.ts')
      const files = store.getViewedFiles(key)
      expect(files).toHaveLength(1)
    })

    it('should remove a viewed file', () => {
      store.setViewedFile(key, 'src/foo.ts')
      store.setViewedFile(key, 'src/bar.ts')

      store.removeViewedFile(key, 'src/foo.ts')
      const files = store.getViewedFiles(key)
      expect(files).toHaveLength(1)
      expect(files[0].filePath).toBe('src/bar.ts')
    })

    it('should not throw when removing non-existent file', () => {
      expect(() => store.removeViewedFile(key, 'nonexistent')).not.toThrow()
    })

    it('should scope by key', () => {
      const key1 = 'github:owner/repo#1'
      const key2 = 'github:owner/repo#2'

      store.setViewedFile(key1, 'src/foo.ts')
      store.setViewedFile(key2, 'src/bar.ts')

      expect(store.getViewedFiles(key1)).toHaveLength(1)
      expect(store.getViewedFiles(key1)[0].filePath).toBe('src/foo.ts')
      expect(store.getViewedFiles(key2)).toHaveLength(1)
      expect(store.getViewedFiles(key2)[0].filePath).toBe('src/bar.ts')
    })
  })

  describe('bookmarked repos', () => {
    it('should return empty array initially', () => {
      expect(store.getBookmarkedRepos()).toEqual([])
    })

    it('should add a bookmarked repo', () => {
      store.addBookmarkedRepo('owner', 'repo')
      const repos = store.getBookmarkedRepos()
      expect(repos).toHaveLength(1)
      expect(repos[0].owner).toBe('owner')
      expect(repos[0].repo).toBe('repo')
    })

    it('should not duplicate when adding same repo twice', () => {
      store.addBookmarkedRepo('owner', 'repo')
      store.addBookmarkedRepo('owner', 'repo')
      expect(store.getBookmarkedRepos()).toHaveLength(1)
    })

    it('should add multiple repos', () => {
      store.addBookmarkedRepo('owner1', 'repo1')
      store.addBookmarkedRepo('owner2', 'repo2')
      expect(store.getBookmarkedRepos()).toHaveLength(2)
    })

    it('should remove a bookmarked repo', () => {
      store.addBookmarkedRepo('owner1', 'repo1')
      store.addBookmarkedRepo('owner2', 'repo2')

      store.removeBookmarkedRepo('owner1', 'repo1')
      const repos = store.getBookmarkedRepos()
      expect(repos).toHaveLength(1)
      expect(repos[0].owner).toBe('owner2')
    })

    it('should not throw when removing non-existent repo', () => {
      expect(() => store.removeBookmarkedRepo('nonexistent', 'repo')).not.toThrow()
    })
  })

  describe('recent repos', () => {
    it('should return empty array initially', () => {
      expect(store.getRecentRepos()).toEqual([])
    })

    it('should add a recent repo', () => {
      store.addRecentRepo('owner', 'repo')
      const repos = store.getRecentRepos()
      expect(repos).toHaveLength(1)
      expect(repos[0].owner).toBe('owner')
      expect(repos[0].repo).toBe('repo')
    })

    it('should update lastUsed when adding same repo again', () => {
      store.addRecentRepo('owner', 'repo')
      const first = store.getRecentRepos()[0].lastUsed

      // Small delay to get different timestamp
      store.addRecentRepo('owner', 'repo')
      const second = store.getRecentRepos()[0].lastUsed

      // Both should exist but only one entry
      expect(store.getRecentRepos()).toHaveLength(1)
      // The timestamp should be updated (or at least not older)
      expect(new Date(second).getTime()).toBeGreaterThanOrEqual(new Date(first).getTime())
    })

    it('should return repos ordered by most recent', () => {
      store.addRecentRepo('owner1', 'repo1')
      store.addRecentRepo('owner2', 'repo2')
      store.addRecentRepo('owner3', 'repo3')

      const repos = store.getRecentRepos()
      expect(repos).toHaveLength(3)

      // All three repos should be present
      const owners = repos.map((r) => r.owner)
      expect(owners).toContain('owner1')
      expect(owners).toContain('owner2')
      expect(owners).toContain('owner3')

      // Verify DESC ordering: each timestamp should be >= the next
      for (let i = 0; i < repos.length - 1; i++) {
        const current = new Date(repos[i].lastUsed).getTime()
        const next = new Date(repos[i + 1].lastUsed).getTime()
        expect(current).toBeGreaterThanOrEqual(next)
      }
    })

    it('should prune old entries beyond limit', () => {
      // Add 25 repos (over the 20 limit)
      for (let i = 0; i < 25; i++) {
        store.addRecentRepo(`owner${i}`, `repo${i}`)
      }
      const repos = store.getRecentRepos()
      expect(repos.length).toBeLessThanOrEqual(20)
    })
  })

  describe('diff bookmarks', () => {
    const key = 'github:owner/repo#1'

    it('should return empty array for no bookmarks', () => {
      expect(store.getDiffBookmarks(key)).toEqual([])
    })

    it('should add a diff bookmark', () => {
      store.setDiffBookmark(key, {
        register: 'a',
        filePath: 'src/foo.ts',
        lineNumber: 42,
      })

      const bookmarks = store.getDiffBookmarks(key)
      expect(bookmarks).toHaveLength(1)
      expect(bookmarks[0].register).toBe('a')
      expect(bookmarks[0].filePath).toBe('src/foo.ts')
      expect(bookmarks[0].lineNumber).toBe(42)
    })

    it('should add a diff bookmark with label', () => {
      store.setDiffBookmark(key, {
        register: 'a',
        filePath: 'src/foo.ts',
        lineNumber: 42,
        label: 'important change',
      })

      const bookmarks = store.getDiffBookmarks(key)
      expect(bookmarks[0].label).toBe('important change')
    })

    it('should update existing bookmark by register', () => {
      store.setDiffBookmark(key, {
        register: 'a',
        filePath: 'src/foo.ts',
        lineNumber: 42,
      })
      store.setDiffBookmark(key, {
        register: 'a',
        filePath: 'src/bar.ts',
        lineNumber: 100,
      })

      const bookmarks = store.getDiffBookmarks(key)
      expect(bookmarks).toHaveLength(1)
      expect(bookmarks[0].filePath).toBe('src/bar.ts')
      expect(bookmarks[0].lineNumber).toBe(100)
    })

    it('should remove a bookmark by register', () => {
      store.setDiffBookmark(key, {
        register: 'a',
        filePath: 'src/foo.ts',
        lineNumber: 42,
      })
      store.setDiffBookmark(key, {
        register: 'b',
        filePath: 'src/bar.ts',
        lineNumber: 10,
      })

      store.removeDiffBookmark(key, 'a')
      const bookmarks = store.getDiffBookmarks(key)
      expect(bookmarks).toHaveLength(1)
      expect(bookmarks[0].register).toBe('b')
    })

    it('should scope bookmarks by key', () => {
      const key1 = 'github:owner/repo#1'
      const key2 = 'github:owner/repo#2'

      store.setDiffBookmark(key1, {
        register: 'a',
        filePath: 'src/foo.ts',
        lineNumber: 1,
      })
      store.setDiffBookmark(key2, {
        register: 'a',
        filePath: 'src/bar.ts',
        lineNumber: 2,
      })

      expect(store.getDiffBookmarks(key1)).toHaveLength(1)
      expect(store.getDiffBookmarks(key1)[0].filePath).toBe('src/foo.ts')
      expect(store.getDiffBookmarks(key2)).toHaveLength(1)
      expect(store.getDiffBookmarks(key2)[0].filePath).toBe('src/bar.ts')
    })
  })

  describe('review checklists', () => {
    const key = 'github:owner/repo#1'

    it('should return empty array for no checklist items', () => {
      expect(store.getChecklistState(key)).toEqual([])
    })

    it('should add a checklist item', () => {
      store.setChecklistItem(key, 'check types', true)
      const items = store.getChecklistState(key)
      expect(items).toHaveLength(1)
      expect(items[0].item).toBe('check types')
      expect(items[0].checked).toBe(true)
    })

    it('should update an existing checklist item', () => {
      store.setChecklistItem(key, 'check types', false)
      store.setChecklistItem(key, 'check types', true)

      const items = store.getChecklistState(key)
      expect(items).toHaveLength(1)
      expect(items[0].checked).toBe(true)
    })

    it('should manage multiple checklist items', () => {
      store.setChecklistItem(key, 'check types', true)
      store.setChecklistItem(key, 'run tests', false)
      store.setChecklistItem(key, 'review logic', true)

      const items = store.getChecklistState(key)
      expect(items).toHaveLength(3)
    })

    it('should scope by key', () => {
      const key1 = 'github:owner/repo#1'
      const key2 = 'github:owner/repo#2'

      store.setChecklistItem(key1, 'item1', true)
      store.setChecklistItem(key2, 'item2', false)

      expect(store.getChecklistState(key1)).toHaveLength(1)
      expect(store.getChecklistState(key1)[0].item).toBe('item1')
      expect(store.getChecklistState(key2)).toHaveLength(1)
      expect(store.getChecklistState(key2)[0].item).toBe('item2')
    })
  })

  describe('key-value store', () => {
    it('should return undefined for non-existent key', () => {
      expect(store.getKV('nonexistent')).toBeUndefined()
    })

    it('should set and get a value', () => {
      store.setKV('theme', 'dark')
      expect(store.getKV('theme')).toBe('dark')
    })

    it('should update an existing value', () => {
      store.setKV('theme', 'dark')
      store.setKV('theme', 'light')
      expect(store.getKV('theme')).toBe('light')
    })

    it('should delete a value', () => {
      store.setKV('theme', 'dark')
      store.deleteKV('theme')
      expect(store.getKV('theme')).toBeUndefined()
    })

    it('should not throw when deleting non-existent key', () => {
      expect(() => store.deleteKV('nonexistent')).not.toThrow()
    })

    it('should handle JSON-serialized values', () => {
      const data = JSON.stringify({ foo: 'bar', num: 42 })
      store.setKV('settings', data)
      const retrieved = store.getKV('settings')
      expect(JSON.parse(retrieved!)).toEqual({ foo: 'bar', num: 42 })
    })

    it('should manage multiple keys independently', () => {
      store.setKV('key1', 'value1')
      store.setKV('key2', 'value2')
      store.setKV('key3', 'value3')

      expect(store.getKV('key1')).toBe('value1')
      expect(store.getKV('key2')).toBe('value2')
      expect(store.getKV('key3')).toBe('value3')

      store.deleteKV('key2')
      expect(store.getKV('key1')).toBe('value1')
      expect(store.getKV('key2')).toBeUndefined()
      expect(store.getKV('key3')).toBe('value3')
    })
  })

  describe('key helpers', () => {
    it('should build PR-scoped key', () => {
      const key = buildPRKey('github', 'owner', 'repo', 42)
      expect(key).toBe('github:owner/repo#42')
    })

    it('should build repo-scoped key', () => {
      const key = buildRepoKey('gitlab', 'owner', 'repo')
      expect(key).toBe('gitlab:owner/repo')
    })

    it('should work with different providers', () => {
      expect(buildPRKey('github', 'a', 'b', 1)).toBe('github:a/b#1')
      expect(buildPRKey('gitlab', 'a', 'b', 1)).toBe('gitlab:a/b#1')
      expect(buildPRKey('bitbucket', 'a', 'b', 1)).toBe('bitbucket:a/b#1')
      expect(buildPRKey('azure', 'a', 'b', 1)).toBe('azure:a/b#1')
      expect(buildPRKey('gitea', 'a', 'b', 1)).toBe('gitea:a/b#1')
    })
  })

  describe('cross-table isolation', () => {
    it('should keep different PR data types independent', () => {
      const prKey = 'github:owner/repo#1'

      store.setPRNotes(prKey, 'my notes')
      store.setReadState(prKey, '2025-01-01T00:00:00Z')
      store.setViewedFile(prKey, 'src/foo.ts')
      store.setChecklistItem(prKey, 'check types', true)
      store.setDiffBookmark(prKey, {
        register: 'a',
        filePath: 'src/foo.ts',
        lineNumber: 42,
      })

      // Deleting notes should not affect other data
      store.deletePRNotes(prKey)
      expect(store.getPRNotes(prKey)).toBeUndefined()
      expect(store.getReadState(prKey)).toBeDefined()
      expect(store.getViewedFiles(prKey)).toHaveLength(1)
      expect(store.getChecklistState(prKey)).toHaveLength(1)
      expect(store.getDiffBookmarks(prKey)).toHaveLength(1)
    })
  })

  describe('concurrent access patterns', () => {
    it('should handle rapid sequential writes', () => {
      for (let i = 0; i < 100; i++) {
        store.setKV(`key-${i}`, `value-${i}`)
      }

      for (let i = 0; i < 100; i++) {
        expect(store.getKV(`key-${i}`)).toBe(`value-${i}`)
      }
    })

    it('should handle interleaved reads and writes', () => {
      const prKey = 'github:owner/repo#1'

      for (let i = 0; i < 50; i++) {
        store.setViewedFile(prKey, `file-${i}.ts`)
        const files = store.getViewedFiles(prKey)
        expect(files).toHaveLength(i + 1)
      }
    })

    it('should handle multiple stores on separate databases', async () => {
      const store2 = createInMemoryStore()
      await store2.open()

      store.setKV('key', 'store1')
      store2.setKV('key', 'store2')

      expect(store.getKV('key')).toBe('store1')
      expect(store2.getKV('key')).toBe('store2')

      store2.close()
    })
  })

  describe('special characters in keys and values', () => {
    it('should handle keys with special characters', () => {
      const key = 'github:owner/repo-with-dashes#123'
      store.setPRNotes(key, 'notes')
      expect(store.getPRNotes(key)?.content).toBe('notes')
    })

    it('should handle values with special characters', () => {
      store.setKV('key', "value with 'quotes' and \"double quotes\"")
      expect(store.getKV('key')).toBe("value with 'quotes' and \"double quotes\"")
    })

    it('should handle unicode in values', () => {
      store.setPRNotes('key', 'Notes with unicode: \u2764\uFE0F \uD83D\uDE80 \u2705')
      expect(store.getPRNotes('key')?.content).toBe('Notes with unicode: \u2764\uFE0F \uD83D\uDE80 \u2705')
    })

    it('should handle empty string values', () => {
      store.setKV('key', '')
      expect(store.getKV('key')).toBe('')
    })

    it('should handle file paths with spaces', () => {
      const key = 'github:owner/repo#1'
      store.setViewedFile(key, 'src/my file.ts')
      const files = store.getViewedFiles(key)
      expect(files[0].filePath).toBe('src/my file.ts')
    })
  })
})
