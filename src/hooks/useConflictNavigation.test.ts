import { describe, it, expect } from 'vitest'
import { clampConflictIndex, nextConflictIndex, prevConflictIndex } from './useConflictNavigation'

describe('nextConflictIndex', () => {
  it('advances to next index', () => {
    expect(nextConflictIndex(0, 3)).toBe(1)
    expect(nextConflictIndex(1, 3)).toBe(2)
  })

  it('wraps around from last to first', () => {
    expect(nextConflictIndex(2, 3)).toBe(0)
  })

  it('returns 0 when total is 0', () => {
    expect(nextConflictIndex(0, 0)).toBe(0)
  })

  it('returns 0 when total is 1', () => {
    expect(nextConflictIndex(0, 1)).toBe(0)
  })
})

describe('prevConflictIndex', () => {
  it('moves to previous index', () => {
    expect(prevConflictIndex(2, 3)).toBe(1)
    expect(prevConflictIndex(1, 3)).toBe(0)
  })

  it('wraps around from first to last', () => {
    expect(prevConflictIndex(0, 3)).toBe(2)
  })

  it('returns 0 when total is 0', () => {
    expect(prevConflictIndex(0, 0)).toBe(0)
  })

  it('returns 0 when total is 1', () => {
    expect(prevConflictIndex(0, 1)).toBe(0)
  })
})

describe('clampConflictIndex', () => {
  it('returns 0 when total is 0', () => {
    expect(clampConflictIndex(5, 0)).toBe(0)
  })

  it('clamps index to max valid value', () => {
    expect(clampConflictIndex(10, 3)).toBe(2)
  })

  it('keeps valid index unchanged', () => {
    expect(clampConflictIndex(1, 3)).toBe(1)
  })

  it('clamps negative index to 0', () => {
    expect(clampConflictIndex(-1, 3)).toBe(0)
  })
})
