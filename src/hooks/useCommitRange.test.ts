import { describe, it, expect } from 'vitest'
import {
  createCommitRangeStore,
  formatRangeLabel,
  computeRangeIndices,
  type CommitRange,
} from './useCommitRange'

describe('formatRangeLabel', () => {
  it('formats two SHAs into a short range label', () => {
    const label = formatRangeLabel(
      'abcdef1234567890abcdef1234567890abcdef12',
      'fedcba0987654321fedcba0987654321fedcba09',
    )
    expect(label).toBe('abcdef1..fedcba0')
  })

  it('handles already-short SHAs', () => {
    const label = formatRangeLabel('abc', 'def')
    expect(label).toBe('abc..def')
  })
})

describe('computeRangeIndices', () => {
  it('returns sorted indices when start < end', () => {
    const result = computeRangeIndices(1, 4)
    expect(result).toEqual({ startIndex: 1, endIndex: 4 })
  })

  it('returns sorted indices when start > end (reversed selection)', () => {
    const result = computeRangeIndices(4, 1)
    expect(result).toEqual({ startIndex: 1, endIndex: 4 })
  })

  it('handles same index for start and end', () => {
    const result = computeRangeIndices(3, 3)
    expect(result).toEqual({ startIndex: 3, endIndex: 3 })
  })
})

describe('CommitRangeStore', () => {
  it('starts with no range and not selecting', () => {
    const store = createCommitRangeStore()
    const state = store.getSnapshot()

    expect(state.range).toBeNull()
    expect(state.isSelecting).toBe(false)
    expect(state.startIndex).toBeNull()
  })

  it('startSelection sets selecting mode with start index', () => {
    const store = createCommitRangeStore()
    store.startSelection(2, 'abc123')

    const state = store.getSnapshot()
    expect(state.isSelecting).toBe(true)
    expect(state.startIndex).toBe(2)
    expect(state.range).toBeNull()
  })

  it('endSelection completes the range', () => {
    const store = createCommitRangeStore()
    store.startSelection(1, 'abc123def456abc123def456abc123def456abc123')
    store.endSelection(3, 'fedcba987654fedcba987654fedcba987654fedcba')

    const state = store.getSnapshot()
    expect(state.isSelecting).toBe(false)
    expect(state.range).not.toBeNull()

    const range = state.range as CommitRange
    expect(range.startSha).toBe('abc123def456abc123def456abc123def456abc123')
    expect(range.endSha).toBe('fedcba987654fedcba987654fedcba987654fedcba')
    expect(range.label).toBe('abc123d..fedcba9')
    expect(range.startIndex).toBe(1)
    expect(range.endIndex).toBe(3)
  })

  it('endSelection normalizes order (start > end)', () => {
    const store = createCommitRangeStore()
    store.startSelection(5, 'sha_five_long_sha_five_long_sha_five_lon')
    store.endSelection(2, 'sha_two_long_sha_two_long_sha_two_longg')

    const state = store.getSnapshot()
    const range = state.range as CommitRange
    // Indices should be normalized so startIndex <= endIndex
    expect(range.startIndex).toBe(2)
    expect(range.endIndex).toBe(5)
    // But SHAs should reflect the actual selection order mapped to normalized indices
    expect(range.startSha).toBe('sha_two_long_sha_two_long_sha_two_longg')
    expect(range.endSha).toBe('sha_five_long_sha_five_long_sha_five_lon')
  })

  it('clearRange resets all state', () => {
    const store = createCommitRangeStore()
    store.startSelection(1, 'abc')
    store.endSelection(3, 'def')
    store.clearRange()

    const state = store.getSnapshot()
    expect(state.range).toBeNull()
    expect(state.isSelecting).toBe(false)
    expect(state.startIndex).toBeNull()
  })

  it('clearRange during selection mode resets without setting range', () => {
    const store = createCommitRangeStore()
    store.startSelection(2, 'abc')
    store.clearRange()

    const state = store.getSnapshot()
    expect(state.range).toBeNull()
    expect(state.isSelecting).toBe(false)
    expect(state.startIndex).toBeNull()
  })

  it('notifies listeners on startSelection', () => {
    const store = createCommitRangeStore()
    let notified = false
    store.subscribe(() => {
      notified = true
    })

    store.startSelection(0, 'abc')
    expect(notified).toBe(true)
  })

  it('notifies listeners on endSelection', () => {
    const store = createCommitRangeStore()
    store.startSelection(0, 'abc')

    let notified = false
    store.subscribe(() => {
      notified = true
    })

    store.endSelection(2, 'def')
    expect(notified).toBe(true)
  })

  it('notifies listeners on clearRange', () => {
    const store = createCommitRangeStore()
    store.startSelection(0, 'abc')
    store.endSelection(2, 'def')

    let notified = false
    store.subscribe(() => {
      notified = true
    })

    store.clearRange()
    expect(notified).toBe(true)
  })

  it('unsubscribe stops notifications', () => {
    const store = createCommitRangeStore()
    let count = 0
    const unsub = store.subscribe(() => {
      count++
    })

    store.startSelection(0, 'abc')
    expect(count).toBe(1)

    unsub()
    store.endSelection(2, 'def')
    expect(count).toBe(1) // Not called again
  })

  it('endSelection without startSelection is a no-op', () => {
    const store = createCommitRangeStore()
    store.endSelection(2, 'def')

    const state = store.getSnapshot()
    expect(state.range).toBeNull()
    expect(state.isSelecting).toBe(false)
  })

  it('isInRange returns false when no range is set', () => {
    const store = createCommitRangeStore()
    expect(store.isInRange(0)).toBe(false)
    expect(store.isInRange(5)).toBe(false)
  })

  it('isInRange returns true for indices within range', () => {
    const store = createCommitRangeStore()
    store.startSelection(1, 'abc')
    store.endSelection(4, 'def')

    expect(store.isInRange(0)).toBe(false)
    expect(store.isInRange(1)).toBe(true)
    expect(store.isInRange(2)).toBe(true)
    expect(store.isInRange(3)).toBe(true)
    expect(store.isInRange(4)).toBe(true)
    expect(store.isInRange(5)).toBe(false)
  })

  it('isInRange works during selection mode (partial range)', () => {
    const store = createCommitRangeStore()
    store.startSelection(2, 'abc')

    // During selection, only the start index is "in range"
    expect(store.isInRange(2)).toBe(true)
    expect(store.isInRange(3)).toBe(false)
  })

  it('multiple unsubscribes are idempotent', () => {
    const store = createCommitRangeStore()
    const unsub = store.subscribe(() => {})
    unsub()
    unsub() // Should not throw
  })
})
