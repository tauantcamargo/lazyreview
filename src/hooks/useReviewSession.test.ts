import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createReviewSessionStore,
  loadSessions,
  persistSession,
  type ReviewSessionStore,
} from './useReviewSession'
import type { StateStore } from '../services/state/types'
import type { ReviewSession } from '../utils/review-stats'
import { serializeSessions } from '../utils/review-stats'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeStore(): ReviewSessionStore {
  return createReviewSessionStore()
}

function makeSession(overrides: Partial<ReviewSession> = {}): ReviewSession {
  return {
    prKey: 'owner/repo#1',
    durationMs: 60000,
    timestamp: '2026-02-14T10:00:00.000Z',
    filesReviewed: 5,
    ...overrides,
  }
}

function createMockStateStore(): StateStore {
  const kvStore = new Map<string, string>()

  return {
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
    getPRNotes: vi.fn(),
    setPRNotes: vi.fn(),
    deletePRNotes: vi.fn(),
    getReadState: vi.fn(),
    setReadState: vi.fn(),
    getViewedFiles: vi.fn().mockReturnValue([]),
    setViewedFile: vi.fn(),
    removeViewedFile: vi.fn(),
    getBookmarkedRepos: vi.fn().mockReturnValue([]),
    addBookmarkedRepo: vi.fn(),
    removeBookmarkedRepo: vi.fn(),
    getRecentRepos: vi.fn().mockReturnValue([]),
    addRecentRepo: vi.fn(),
    getDiffBookmarks: vi.fn().mockReturnValue([]),
    setDiffBookmark: vi.fn(),
    removeDiffBookmark: vi.fn(),
    getChecklistState: vi.fn().mockReturnValue([]),
    setChecklistItem: vi.fn(),
    getKV: vi.fn((key: string) => kvStore.get(key)),
    setKV: vi.fn((key: string, value: string) => { kvStore.set(key, value) }),
    deleteKV: vi.fn((key: string) => { kvStore.delete(key) }),
  }
}

// ---------------------------------------------------------------------------
// ReviewSessionStore tests
// ---------------------------------------------------------------------------

describe('ReviewSessionStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with zero elapsed and not paused', () => {
    const store = makeStore()
    const snapshot = store.getSnapshot()
    expect(snapshot.elapsedSeconds).toBe(0)
    expect(snapshot.isPaused).toBe(false)
  })

  it('increments elapsed seconds after start', () => {
    const store = makeStore()
    store.start()

    vi.advanceTimersByTime(3000)
    expect(store.getElapsedSeconds()).toBe(3)

    store.destroy()
  })

  it('does not increment when paused', () => {
    const store = makeStore()
    store.start()

    vi.advanceTimersByTime(2000)
    expect(store.getElapsedSeconds()).toBe(2)

    store.togglePause()
    vi.advanceTimersByTime(3000)
    expect(store.getElapsedSeconds()).toBe(2) // Still 2

    store.destroy()
  })

  it('resumes incrementing after unpause', () => {
    const store = makeStore()
    store.start()

    vi.advanceTimersByTime(2000)
    store.togglePause()
    vi.advanceTimersByTime(5000)
    store.togglePause() // Unpause

    vi.advanceTimersByTime(3000)
    expect(store.getElapsedSeconds()).toBe(5) // 2 + 3 (paused time not counted)

    store.destroy()
  })

  it('stop halts the timer', () => {
    const store = makeStore()
    store.start()

    vi.advanceTimersByTime(5000)
    store.stop()

    const elapsed = store.getElapsedSeconds()
    vi.advanceTimersByTime(5000)
    expect(store.getElapsedSeconds()).toBe(elapsed) // Unchanged

    store.destroy()
  })

  it('start is idempotent', () => {
    const store = makeStore()
    store.start()
    store.start() // Should not reset or double-tick

    vi.advanceTimersByTime(2000)
    expect(store.getElapsedSeconds()).toBe(2)

    store.destroy()
  })

  it('stop is idempotent', () => {
    const store = makeStore()
    store.start()
    vi.advanceTimersByTime(2000)
    store.stop()
    store.stop() // Should not throw

    expect(store.getElapsedSeconds()).toBe(2)

    store.destroy()
  })

  it('notifies listeners on tick', () => {
    const store = makeStore()
    const listener = vi.fn()

    store.subscribe(listener)
    store.start()

    vi.advanceTimersByTime(1000)
    // start() notifies once + tick notifies once = 2
    expect(listener).toHaveBeenCalledTimes(2)

    store.destroy()
  })

  it('notifies listeners on togglePause', () => {
    const store = makeStore()
    store.start()

    const listener = vi.fn()
    store.subscribe(listener)

    store.togglePause()
    expect(listener).toHaveBeenCalledOnce()

    store.destroy()
  })

  it('unsubscribe stops notifications', () => {
    const store = makeStore()
    const listener = vi.fn()

    const unsub = store.subscribe(listener)
    unsub()

    store.start()
    vi.advanceTimersByTime(2000)

    expect(listener).not.toHaveBeenCalled()

    store.destroy()
  })

  it('destroy clears state and stops timer', () => {
    const store = makeStore()
    store.start()
    vi.advanceTimersByTime(5000)

    store.destroy()

    expect(store.getElapsedSeconds()).toBe(0)
    expect(store.isPaused()).toBe(false)
  })

  it('isPaused returns correct state', () => {
    const store = makeStore()
    expect(store.isPaused()).toBe(false)

    store.togglePause()
    expect(store.isPaused()).toBe(true)

    store.togglePause()
    expect(store.isPaused()).toBe(false)

    store.destroy()
  })
})

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

describe('loadSessions', () => {
  it('returns empty array when no KV data exists', () => {
    const stateStore = createMockStateStore()
    const result = loadSessions(stateStore)
    expect(result).toEqual([])
  })

  it('loads sessions from KV store', () => {
    const stateStore = createMockStateStore()
    const sessions = [
      makeSession({ prKey: 'a/b#1' }),
      makeSession({ prKey: 'c/d#2' }),
    ]
    stateStore.setKV('review_sessions', serializeSessions(sessions))

    const result = loadSessions(stateStore)
    expect(result).toHaveLength(2)
    expect(result[0]?.prKey).toBe('a/b#1')
    expect(result[1]?.prKey).toBe('c/d#2')
  })

  it('returns empty array for corrupted data', () => {
    const stateStore = createMockStateStore()
    stateStore.setKV('review_sessions', 'not-json')

    const result = loadSessions(stateStore)
    expect(result).toEqual([])
  })
})

describe('persistSession', () => {
  it('persists a session to empty store', () => {
    const stateStore = createMockStateStore()
    const session = makeSession({ prKey: 'owner/repo#42' })

    persistSession(stateStore, session)

    const loaded = loadSessions(stateStore)
    expect(loaded).toHaveLength(1)
    expect(loaded[0]?.prKey).toBe('owner/repo#42')
  })

  it('appends to existing sessions', () => {
    const stateStore = createMockStateStore()
    const session1 = makeSession({ prKey: 'a/b#1' })
    const session2 = makeSession({ prKey: 'c/d#2' })

    persistSession(stateStore, session1)
    persistSession(stateStore, session2)

    const loaded = loadSessions(stateStore)
    expect(loaded).toHaveLength(2)
    expect(loaded[0]?.prKey).toBe('a/b#1')
    expect(loaded[1]?.prKey).toBe('c/d#2')
  })

  it('preserves existing sessions when appending', () => {
    const stateStore = createMockStateStore()
    const existing = [makeSession({ prKey: 'existing#1', durationMs: 99999 })]
    stateStore.setKV('review_sessions', serializeSessions(existing))

    const newSession = makeSession({ prKey: 'new#2' })
    persistSession(stateStore, newSession)

    const loaded = loadSessions(stateStore)
    expect(loaded).toHaveLength(2)
    expect(loaded[0]?.prKey).toBe('existing#1')
    expect(loaded[0]?.durationMs).toBe(99999)
    expect(loaded[1]?.prKey).toBe('new#2')
  })
})
