import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  pruneOldEntries,
  createViewedFilesStore,
  createSqliteViewedFilesStore,
  type ViewedFilesData,
} from './useViewedFiles'
import { createInMemoryStore } from '../services/state/StateStore'
import type { StateStore } from '../services/state/types'

describe('pruneOldEntries', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps entries newer than 30 days', () => {
    const now = new Date('2026-02-10T00:00:00Z')
    vi.setSystemTime(now)

    const data: ViewedFilesData = {
      'https://github.com/owner/repo/pull/1': {
        viewedFiles: ['src/foo.ts'],
        lastUpdated: '2026-02-05T00:00:00Z',
      },
    }

    const result = pruneOldEntries(data)
    expect(Object.keys(result)).toHaveLength(1)
  })

  it('removes entries older than 30 days', () => {
    const now = new Date('2026-02-10T00:00:00Z')
    vi.setSystemTime(now)

    const data: ViewedFilesData = {
      'https://github.com/owner/repo/pull/1': {
        viewedFiles: ['src/foo.ts'],
        lastUpdated: '2025-12-01T00:00:00Z',
      },
    }

    const result = pruneOldEntries(data)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('handles mixed old and new entries', () => {
    const now = new Date('2026-02-10T00:00:00Z')
    vi.setSystemTime(now)

    const data: ViewedFilesData = {
      'https://github.com/owner/repo/pull/1': {
        viewedFiles: ['src/old.ts'],
        lastUpdated: '2025-12-01T00:00:00Z',
      },
      'https://github.com/owner/repo/pull/2': {
        viewedFiles: ['src/new.ts'],
        lastUpdated: '2026-02-09T00:00:00Z',
      },
    }

    const result = pruneOldEntries(data)
    expect(Object.keys(result)).toHaveLength(1)
    expect(result['https://github.com/owner/repo/pull/2']).toBeDefined()
  })

  it('returns empty object for empty input', () => {
    expect(pruneOldEntries({})).toEqual({})
  })
})

describe('ViewedFilesStore (in-memory)', () => {
  it('marks a file as viewed', () => {
    const store = createViewedFilesStore()
    const prUrl = 'https://github.com/owner/repo/pull/1'

    store.markViewed(prUrl, 'src/foo.ts')
    expect(store.isViewed(prUrl, 'src/foo.ts')).toBe(true)
  })

  it('returns false for unviewed files', () => {
    const store = createViewedFilesStore()
    const prUrl = 'https://github.com/owner/repo/pull/1'

    expect(store.isViewed(prUrl, 'src/foo.ts')).toBe(false)
  })

  it('marks a file as unviewed', () => {
    const store = createViewedFilesStore()
    const prUrl = 'https://github.com/owner/repo/pull/1'

    store.markViewed(prUrl, 'src/foo.ts')
    store.markUnviewed(prUrl, 'src/foo.ts')
    expect(store.isViewed(prUrl, 'src/foo.ts')).toBe(false)
  })

  it('toggles viewed state', () => {
    const store = createViewedFilesStore()
    const prUrl = 'https://github.com/owner/repo/pull/1'

    store.toggleViewed(prUrl, 'src/foo.ts')
    expect(store.isViewed(prUrl, 'src/foo.ts')).toBe(true)

    store.toggleViewed(prUrl, 'src/foo.ts')
    expect(store.isViewed(prUrl, 'src/foo.ts')).toBe(false)
  })

  it('counts viewed files', () => {
    const store = createViewedFilesStore()
    const prUrl = 'https://github.com/owner/repo/pull/1'

    expect(store.getViewedCount(prUrl)).toBe(0)
    store.markViewed(prUrl, 'src/a.ts')
    store.markViewed(prUrl, 'src/b.ts')
    expect(store.getViewedCount(prUrl)).toBe(2)
  })

  it('does not duplicate already-viewed files', () => {
    const store = createViewedFilesStore()
    const prUrl = 'https://github.com/owner/repo/pull/1'

    store.markViewed(prUrl, 'src/foo.ts')
    store.markViewed(prUrl, 'src/foo.ts')
    expect(store.getViewedCount(prUrl)).toBe(1)
  })

  it('scopes state per PR', () => {
    const store = createViewedFilesStore()
    const pr1 = 'https://github.com/owner/repo/pull/1'
    const pr2 = 'https://github.com/owner/repo/pull/2'

    store.markViewed(pr1, 'src/foo.ts')
    expect(store.isViewed(pr1, 'src/foo.ts')).toBe(true)
    expect(store.isViewed(pr2, 'src/foo.ts')).toBe(false)
  })

  it('notifies listeners on change', () => {
    const store = createViewedFilesStore()
    const listener = vi.fn()

    store.subscribe(listener)
    store.markViewed('https://github.com/owner/repo/pull/1', 'src/foo.ts')
    expect(listener).toHaveBeenCalledOnce()
  })

  it('unsubscribe stops notifications', () => {
    const store = createViewedFilesStore()
    const listener = vi.fn()

    const unsub = store.subscribe(listener)
    unsub()
    store.markViewed('https://github.com/owner/repo/pull/1', 'src/foo.ts')
    expect(listener).not.toHaveBeenCalled()
  })

  it('markUnviewed on non-existent PR is a no-op', () => {
    const store = createViewedFilesStore()
    const prUrl = 'https://github.com/owner/repo/pull/999'

    store.markUnviewed(prUrl, 'src/foo.ts')
    expect(store.isViewed(prUrl, 'src/foo.ts')).toBe(false)
  })

  it('returns 0 count for unknown PR', () => {
    const store = createViewedFilesStore()
    expect(
      store.getViewedCount('https://github.com/owner/repo/pull/unknown'),
    ).toBe(0)
  })

  it('notifies on markUnviewed', () => {
    const store = createViewedFilesStore()
    const prUrl = 'https://github.com/owner/repo/pull/1'
    store.markViewed(prUrl, 'src/foo.ts')

    const listener = vi.fn()
    store.subscribe(listener)
    store.markUnviewed(prUrl, 'src/foo.ts')
    expect(listener).toHaveBeenCalledOnce()
  })

  it('notifies on toggleViewed', () => {
    const store = createViewedFilesStore()
    const listener = vi.fn()
    store.subscribe(listener)
    store.toggleViewed('https://github.com/owner/repo/pull/1', 'src/foo.ts')
    expect(listener).toHaveBeenCalledOnce()
  })

  it('snapshot reflects current state', () => {
    const store = createViewedFilesStore()
    const prUrl = 'https://github.com/owner/repo/pull/1'

    store.markViewed(prUrl, 'src/a.ts')
    store.markViewed(prUrl, 'src/b.ts')

    const snapshot = store.getSnapshot()
    expect(snapshot[prUrl]?.viewedFiles).toContain('src/a.ts')
    expect(snapshot[prUrl]?.viewedFiles).toContain('src/b.ts')
    expect(snapshot[prUrl]?.viewedFiles).toHaveLength(2)
  })

  it('multiple unsubscribes are idempotent', () => {
    const store = createViewedFilesStore()
    const listener = vi.fn()
    const unsub = store.subscribe(listener)
    unsub()
    unsub()
    store.markViewed('https://github.com/owner/repo/pull/1', 'src/foo.ts')
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('ViewedFilesStore (SQLite-backed)', () => {
  let stateStore: StateStore

  beforeEach(async () => {
    stateStore = createInMemoryStore()
    await stateStore.open()
  })

  afterEach(() => {
    stateStore.close()
  })

  it('marks a file as viewed and persists to SQLite', () => {
    const store = createSqliteViewedFilesStore(stateStore)
    store.markViewed('pr-key-1', 'src/foo.ts')
    expect(store.isViewed('pr-key-1', 'src/foo.ts')).toBe(true)
    expect(stateStore.getViewedFiles('pr-key-1')).toHaveLength(1)
    expect(stateStore.getViewedFiles('pr-key-1')[0].filePath).toBe('src/foo.ts')
  })

  it('marks a file as unviewed and removes from SQLite', () => {
    const store = createSqliteViewedFilesStore(stateStore)
    store.markViewed('pr-key-1', 'src/foo.ts')
    store.markUnviewed('pr-key-1', 'src/foo.ts')
    expect(store.isViewed('pr-key-1', 'src/foo.ts')).toBe(false)
    expect(stateStore.getViewedFiles('pr-key-1')).toHaveLength(0)
  })

  it('toggles viewed state via SQLite', () => {
    const store = createSqliteViewedFilesStore(stateStore)
    store.toggleViewed('pr-key-1', 'src/foo.ts')
    expect(store.isViewed('pr-key-1', 'src/foo.ts')).toBe(true)
    store.toggleViewed('pr-key-1', 'src/foo.ts')
    expect(store.isViewed('pr-key-1', 'src/foo.ts')).toBe(false)
  })

  it('counts viewed files from SQLite', () => {
    const store = createSqliteViewedFilesStore(stateStore)
    store.markViewed('pr-1', 'src/a.ts')
    store.markViewed('pr-1', 'src/b.ts')
    store.markViewed('pr-1', 'src/c.ts')
    expect(store.getViewedCount('pr-1')).toBe(3)
  })

  it('does not duplicate already-viewed files in SQLite', () => {
    const store = createSqliteViewedFilesStore(stateStore)
    store.markViewed('pr-1', 'src/foo.ts')
    store.markViewed('pr-1', 'src/foo.ts')
    expect(store.getViewedCount('pr-1')).toBe(1)
  })

  it('scopes state per PR key in SQLite', () => {
    const store = createSqliteViewedFilesStore(stateStore)
    store.markViewed('pr-1', 'src/foo.ts')
    store.markViewed('pr-2', 'src/bar.ts')
    expect(store.isViewed('pr-1', 'src/foo.ts')).toBe(true)
    expect(store.isViewed('pr-1', 'src/bar.ts')).toBe(false)
    expect(store.isViewed('pr-2', 'src/bar.ts')).toBe(true)
    expect(store.isViewed('pr-2', 'src/foo.ts')).toBe(false)
  })

  it('notifies listeners on SQLite-backed changes', () => {
    const store = createSqliteViewedFilesStore(stateStore)
    const listener = vi.fn()
    store.subscribe(listener)
    store.markViewed('pr-1', 'src/foo.ts')
    expect(listener).toHaveBeenCalledOnce()
  })

  it('snapshot reflects SQLite state', () => {
    const store = createSqliteViewedFilesStore(stateStore)
    store.markViewed('pr-1', 'src/a.ts')
    store.markViewed('pr-1', 'src/b.ts')
    const snapshot = store.getSnapshot()
    expect(snapshot['pr-1']?.viewedFiles).toContain('src/a.ts')
    expect(snapshot['pr-1']?.viewedFiles).toContain('src/b.ts')
    expect(snapshot['pr-1']?.viewedFiles).toHaveLength(2)
  })

  it('markUnviewed on non-existent PR is a no-op', () => {
    const store = createSqliteViewedFilesStore(stateStore)
    store.markUnviewed('nonexistent', 'src/foo.ts')
    expect(store.isViewed('nonexistent', 'src/foo.ts')).toBe(false)
  })

  it('returns 0 count for unknown PR', () => {
    const store = createSqliteViewedFilesStore(stateStore)
    expect(store.getViewedCount('unknown-pr')).toBe(0)
  })
})
