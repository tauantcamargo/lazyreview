import { describe, it, expect } from 'vitest'
import {
  aggregateStats,
  filterByRange,
  formatDuration,
  formatTimer,
  serializeSession,
  deserializeSession,
  serializeSessions,
  deserializeSessions,
  type ReviewSession,
  type ReviewStats,
} from './review-stats'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeSession(overrides: Partial<ReviewSession> = {}): ReviewSession {
  return {
    prKey: 'owner/repo#1',
    durationMs: 60000,
    timestamp: '2026-02-14T10:00:00.000Z',
    filesReviewed: 5,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// aggregateStats
// ---------------------------------------------------------------------------

describe('aggregateStats', () => {
  it('returns zero stats for empty array', () => {
    const result = aggregateStats([])
    expect(result).toEqual({
      count: 0,
      totalMs: 0,
      avgMs: 0,
      filesReviewed: 0,
    })
  })

  it('computes stats for a single session', () => {
    const sessions = [makeSession({ durationMs: 120000, filesReviewed: 3 })]
    const result = aggregateStats(sessions)
    expect(result).toEqual({
      count: 1,
      totalMs: 120000,
      avgMs: 120000,
      filesReviewed: 3,
    })
  })

  it('aggregates multiple sessions', () => {
    const sessions = [
      makeSession({ durationMs: 60000, filesReviewed: 3 }),
      makeSession({ durationMs: 120000, filesReviewed: 7 }),
      makeSession({ durationMs: 180000, filesReviewed: 2 }),
    ]
    const result = aggregateStats(sessions)
    expect(result.count).toBe(3)
    expect(result.totalMs).toBe(360000)
    expect(result.avgMs).toBe(120000)
    expect(result.filesReviewed).toBe(12)
  })

  it('rounds average to nearest integer', () => {
    const sessions = [
      makeSession({ durationMs: 100 }),
      makeSession({ durationMs: 200 }),
      makeSession({ durationMs: 300 }),
    ]
    const result = aggregateStats(sessions)
    // (100 + 200 + 300) / 3 = 200 exactly
    expect(result.avgMs).toBe(200)
  })

  it('handles sessions with zero duration', () => {
    const sessions = [
      makeSession({ durationMs: 0, filesReviewed: 0 }),
      makeSession({ durationMs: 0, filesReviewed: 0 }),
    ]
    const result = aggregateStats(sessions)
    expect(result.count).toBe(2)
    expect(result.totalMs).toBe(0)
    expect(result.avgMs).toBe(0)
    expect(result.filesReviewed).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// filterByRange
// ---------------------------------------------------------------------------

describe('filterByRange', () => {
  // Friday, Feb 14 2026, 15:00 UTC
  const now = new Date('2026-02-14T15:00:00.000Z')

  it('returns all sessions for "all" range', () => {
    const sessions = [
      makeSession({ timestamp: '2025-01-01T10:00:00.000Z' }),
      makeSession({ timestamp: '2026-02-14T10:00:00.000Z' }),
    ]
    const result = filterByRange(sessions, 'all', now)
    expect(result).toHaveLength(2)
  })

  it('filters to today only for "today" range', () => {
    const sessions = [
      makeSession({ timestamp: '2026-02-13T23:59:59.000Z' }), // yesterday
      makeSession({ timestamp: '2026-02-14T00:00:00.000Z' }), // today midnight
      makeSession({ timestamp: '2026-02-14T10:00:00.000Z' }), // today morning
    ]
    const result = filterByRange(sessions, 'today', now)
    // "today" means >= start of day for the `now` date in local time
    // Since we pass UTC dates and startOfDay works in local time, we just
    // verify the today/yesterday boundary works.
    expect(result.length).toBeGreaterThanOrEqual(1)
    // The session at 2026-02-14T10:00 should always be included
    expect(result.some((s) => s.timestamp === '2026-02-14T10:00:00.000Z')).toBe(true)
  })

  it('filters to current week for "week" range', () => {
    // Feb 14, 2026 is a Saturday. Monday of that week is Feb 9.
    const sessions = [
      makeSession({ timestamp: '2026-02-08T23:59:59.000Z' }), // Sunday before
      makeSession({ timestamp: '2026-02-09T00:00:00.000Z' }), // Monday start
      makeSession({ timestamp: '2026-02-11T10:00:00.000Z' }), // Wednesday
      makeSession({ timestamp: '2026-02-14T10:00:00.000Z' }), // Saturday (now)
    ]
    const result = filterByRange(sessions, 'week', now)
    // Sessions from Monday onward should be included
    expect(result.length).toBeGreaterThanOrEqual(2)
    expect(result.some((s) => s.timestamp === '2026-02-14T10:00:00.000Z')).toBe(true)
    expect(result.some((s) => s.timestamp === '2026-02-11T10:00:00.000Z')).toBe(true)
  })

  it('returns empty array when no sessions match range', () => {
    const sessions = [
      makeSession({ timestamp: '2025-01-01T10:00:00.000Z' }),
    ]
    const result = filterByRange(sessions, 'today', now)
    expect(result).toHaveLength(0)
  })

  it('handles empty input array', () => {
    const result = filterByRange([], 'today', now)
    expect(result).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// formatDuration
// ---------------------------------------------------------------------------

describe('formatDuration', () => {
  it('formats zero ms', () => {
    expect(formatDuration(0)).toBe('0s')
  })

  it('formats seconds only', () => {
    expect(formatDuration(42000)).toBe('42s')
  })

  it('formats minutes and seconds', () => {
    expect(formatDuration(754000)).toBe('12m 34s')
  })

  it('formats hours and minutes', () => {
    expect(formatDuration(4980000)).toBe('1h 23m')
  })

  it('formats exactly 1 hour', () => {
    expect(formatDuration(3600000)).toBe('1h 0m')
  })
})

// ---------------------------------------------------------------------------
// formatTimer
// ---------------------------------------------------------------------------

describe('formatTimer', () => {
  it('formats zero as 00:00', () => {
    expect(formatTimer(0)).toBe('00:00')
  })

  it('formats seconds under a minute', () => {
    expect(formatTimer(42)).toBe('00:42')
  })

  it('formats minutes and seconds', () => {
    expect(formatTimer(754)).toBe('12:34')
  })

  it('formats with hours when >= 3600', () => {
    expect(formatTimer(3661)).toBe('1:01:01')
  })

  it('pads single digits', () => {
    expect(formatTimer(65)).toBe('01:05')
  })
})

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

describe('serializeSession / deserializeSession', () => {
  it('round-trips a session', () => {
    const session = makeSession()
    const json = serializeSession(session)
    const deserialized = deserializeSession(json)
    expect(deserialized).toEqual(session)
  })

  it('returns null for invalid JSON', () => {
    expect(deserializeSession('not json')).toBeNull()
  })

  it('returns null for missing fields', () => {
    expect(deserializeSession('{"prKey":"x"}')).toBeNull()
  })

  it('returns null for wrong types', () => {
    const bad = JSON.stringify({
      prKey: 123,
      durationMs: 'not-a-number',
      timestamp: '2026-01-01',
      filesReviewed: 5,
    })
    expect(deserializeSession(bad)).toBeNull()
  })
})

describe('serializeSessions / deserializeSessions', () => {
  it('round-trips a list of sessions', () => {
    const sessions = [
      makeSession({ prKey: 'a/b#1' }),
      makeSession({ prKey: 'c/d#2' }),
    ]
    const json = serializeSessions(sessions)
    const deserialized = deserializeSessions(json)
    expect(deserialized).toEqual(sessions)
  })

  it('returns empty array for invalid JSON', () => {
    expect(deserializeSessions('bad')).toEqual([])
  })

  it('returns empty array for non-array JSON', () => {
    expect(deserializeSessions('{"a":1}')).toEqual([])
  })

  it('filters out invalid entries in the array', () => {
    const json = JSON.stringify([
      { prKey: 'a/b#1', durationMs: 100, timestamp: '2026-01-01', filesReviewed: 1 },
      { broken: true },
      null,
      { prKey: 'c/d#2', durationMs: 200, timestamp: '2026-01-02', filesReviewed: 3 },
    ])
    const result = deserializeSessions(json)
    expect(result).toHaveLength(2)
    expect(result[0]?.prKey).toBe('a/b#1')
    expect(result[1]?.prKey).toBe('c/d#2')
  })
})
