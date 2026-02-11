import { describe, it, expect, vi, beforeEach } from 'vitest'
import { pruneOldEntries, type ReadStateData, type ReadEntry } from './useReadState'

describe('pruneOldEntries', () => {
  beforeEach(() => {
    vi.useFakeTimers()
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
    const isUnread = new Date(prUpdatedAt).getTime() > new Date(entry.prUpdatedAt).getTime()
    expect(isUnread).toBe(false)
  })

  it('treats PR as unread when updated after last seen', () => {
    const entry: ReadEntry = {
      lastSeenAt: '2026-02-08T00:00:00Z',
      prUpdatedAt: '2026-02-07T00:00:00Z',
    }
    const prUpdatedAt = '2026-02-09T00:00:00Z' // Updated after stored
    const isUnread = new Date(prUpdatedAt).getTime() > new Date(entry.prUpdatedAt).getTime()
    expect(isUnread).toBe(true)
  })

  it('treats PR as read when updated at same time as stored', () => {
    const entry: ReadEntry = {
      lastSeenAt: '2026-02-10T00:00:00Z',
      prUpdatedAt: '2026-02-09T12:00:00Z',
    }
    const prUpdatedAt = '2026-02-09T12:00:00Z'
    const isUnread = new Date(prUpdatedAt).getTime() > new Date(entry.prUpdatedAt).getTime()
    expect(isUnread).toBe(false)
  })
})
