import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  pruneOldEntries,
  createReadStateStore,
  type ReadStateData,
  type ReadEntry,
} from './useReadState'

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

    const data: ReadStateData = {
      'https://github.com/owner/repo/pull/1': {
        lastSeenAt: '2026-02-05T00:00:00Z', // 5 days ago
        prUpdatedAt: '2026-02-04T00:00:00Z',
      },
    }

    const result = pruneOldEntries(data)
    expect(Object.keys(result)).toHaveLength(1)
  })

  it('removes entries older than 30 days', () => {
    const now = new Date('2026-02-10T00:00:00Z')
    vi.setSystemTime(now)

    const data: ReadStateData = {
      'https://github.com/owner/repo/pull/1': {
        lastSeenAt: '2025-12-01T00:00:00Z', // ~71 days ago
        prUpdatedAt: '2025-11-30T00:00:00Z',
      },
    }

    const result = pruneOldEntries(data)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('handles mixed old and new entries', () => {
    const now = new Date('2026-02-10T00:00:00Z')
    vi.setSystemTime(now)

    const data: ReadStateData = {
      'https://github.com/owner/repo/pull/1': {
        lastSeenAt: '2025-12-01T00:00:00Z', // old
        prUpdatedAt: '2025-11-30T00:00:00Z',
      },
      'https://github.com/owner/repo/pull/2': {
        lastSeenAt: '2026-02-09T00:00:00Z', // recent
        prUpdatedAt: '2026-02-08T00:00:00Z',
      },
    }

    const result = pruneOldEntries(data)
    expect(Object.keys(result)).toHaveLength(1)
    expect(result['https://github.com/owner/repo/pull/2']).toBeDefined()
  })

  it('returns empty object for empty input', () => {
    expect(pruneOldEntries({})).toEqual({})
  })

  it('keeps entry exactly at 30-day boundary', () => {
    const now = new Date('2026-02-10T00:00:00Z')
    vi.setSystemTime(now)

    // 29 days, 23 hours, 59 minutes ago - should keep
    const data: ReadStateData = {
      'https://github.com/owner/repo/pull/1': {
        lastSeenAt: '2026-01-11T00:01:00Z',
        prUpdatedAt: '2026-01-10T00:00:00Z',
      },
    }

    const result = pruneOldEntries(data)
    expect(Object.keys(result)).toHaveLength(1)
  })
})

describe('ReadStateStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-10T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with empty state', () => {
    const store = createReadStateStore()
    expect(store.getSnapshot()).toEqual({})
  })

  it('marks a PR as read', () => {
    const store = createReadStateStore()
    const url = 'https://github.com/owner/repo/pull/1'
    store.markAsRead(url, '2026-02-10T00:00:00Z')

    const snapshot = store.getSnapshot()
    expect(snapshot[url]).toBeDefined()
    expect(snapshot[url]!.prUpdatedAt).toBe('2026-02-10T00:00:00Z')
  })

  it('detects unread PR (never seen)', () => {
    const store = createReadStateStore()
    const url = 'https://github.com/owner/repo/pull/1'
    expect(store.isUnread(url, '2026-02-10T00:00:00Z')).toBe(true)
  })

  it('detects read PR (not updated since seen)', () => {
    const store = createReadStateStore()
    const url = 'https://github.com/owner/repo/pull/1'
    store.markAsRead(url, '2026-02-10T00:00:00Z')
    expect(store.isUnread(url, '2026-02-10T00:00:00Z')).toBe(false)
  })

  it('detects unread PR (updated after seen)', () => {
    const store = createReadStateStore()
    const url = 'https://github.com/owner/repo/pull/1'
    store.markAsRead(url, '2026-02-09T00:00:00Z')
    // PR was updated after the stored prUpdatedAt
    expect(store.isUnread(url, '2026-02-10T00:00:00Z')).toBe(true)
  })

  it('notifies subscribers on markAsRead', () => {
    const store = createReadStateStore()
    const listener = vi.fn()
    store.subscribe(listener)
    store.markAsRead('https://github.com/owner/repo/pull/1', '2026-02-10T00:00:00Z')
    expect(listener).toHaveBeenCalledOnce()
  })

  it('unsubscribe stops notifications', () => {
    const store = createReadStateStore()
    const listener = vi.fn()
    const unsub = store.subscribe(listener)
    unsub()
    store.markAsRead('https://github.com/owner/repo/pull/1', '2026-02-10T00:00:00Z')
    expect(listener).not.toHaveBeenCalled()
  })

  it('supports multiple subscribers', () => {
    const store = createReadStateStore()
    const l1 = vi.fn()
    const l2 = vi.fn()
    store.subscribe(l1)
    store.subscribe(l2)
    store.markAsRead('https://github.com/owner/repo/pull/1', '2026-02-10T00:00:00Z')
    expect(l1).toHaveBeenCalledOnce()
    expect(l2).toHaveBeenCalledOnce()
  })

  it('updates existing entry on re-read', () => {
    const store = createReadStateStore()
    const url = 'https://github.com/owner/repo/pull/1'
    store.markAsRead(url, '2026-02-09T00:00:00Z')
    store.markAsRead(url, '2026-02-10T00:00:00Z')

    const snapshot = store.getSnapshot()
    expect(snapshot[url]!.prUpdatedAt).toBe('2026-02-10T00:00:00Z')
  })
})

describe('ReadState isUnread logic', () => {
  it('treats unseen PR as unread', () => {
    const data: ReadStateData = {}
    const entry = data['https://github.com/owner/repo/pull/1']
    expect(entry).toBeUndefined() // No entry = unread
  })

  it('treats PR as read when prUpdatedAt matches stored value', () => {
    const entry: ReadEntry = {
      lastSeenAt: '2026-02-10T00:00:00Z',
      prUpdatedAt: '2026-02-09T00:00:00Z',
    }
    const prUpdatedAt = '2026-02-09T00:00:00Z'
    const isUnread =
      new Date(prUpdatedAt).getTime() > new Date(entry.prUpdatedAt).getTime()
    expect(isUnread).toBe(false)
  })

  it('treats PR as unread when updated after last seen', () => {
    const entry: ReadEntry = {
      lastSeenAt: '2026-02-08T00:00:00Z',
      prUpdatedAt: '2026-02-07T00:00:00Z',
    }
    const prUpdatedAt = '2026-02-09T00:00:00Z' // Updated after stored
    const isUnread =
      new Date(prUpdatedAt).getTime() > new Date(entry.prUpdatedAt).getTime()
    expect(isUnread).toBe(true)
  })

  it('treats PR as read when updated at same time as stored', () => {
    const entry: ReadEntry = {
      lastSeenAt: '2026-02-10T00:00:00Z',
      prUpdatedAt: '2026-02-09T12:00:00Z',
    }
    const prUpdatedAt = '2026-02-09T12:00:00Z'
    const isUnread =
      new Date(prUpdatedAt).getTime() > new Date(entry.prUpdatedAt).getTime()
    expect(isUnread).toBe(false)
  })
})
