import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  pruneOldEntries,
  createViewedFilesStore,
  type ViewedFilesData,
} from './useViewedFiles'

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(() => {
    throw new Error('ENOENT')
  }),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}))

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(() => Promise.resolve()),
  mkdir: vi.fn(() => Promise.resolve()),
}))

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
        lastUpdated: '2026-02-05T00:00:00Z', // 5 days ago
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
        lastUpdated: '2025-12-01T00:00:00Z', // ~71 days ago
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
        lastUpdated: '2025-12-01T00:00:00Z', // old
      },
      'https://github.com/owner/repo/pull/2': {
        viewedFiles: ['src/new.ts'],
        lastUpdated: '2026-02-09T00:00:00Z', // recent
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

describe('ViewedFilesStore', () => {
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

    // Should not throw
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
    unsub() // Should not throw
    store.markViewed('https://github.com/owner/repo/pull/1', 'src/foo.ts')
    expect(listener).not.toHaveBeenCalled()
  })
})
