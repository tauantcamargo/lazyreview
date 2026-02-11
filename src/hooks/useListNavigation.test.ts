import { describe, it, expect } from 'vitest'
import { deriveScrollOffset } from './useListNavigation'

describe('deriveScrollOffset', () => {
  it('returns 0 when all items fit in viewport', () => {
    expect(deriveScrollOffset(3, 10, 5)).toBe(0)
  })

  it('returns 0 when selected index is near the top', () => {
    expect(deriveScrollOffset(2, 10, 50)).toBe(0)
  })

  it('centers selection in viewport', () => {
    // selectedIndex=20, viewport=10, so offset = 20 - 5 = 15
    expect(deriveScrollOffset(20, 10, 50)).toBe(15)
  })

  it('does not scroll past the end', () => {
    // selectedIndex=48, viewport=10, items=50 -> offset = 48-5=43 but max is 50-10=40
    expect(deriveScrollOffset(48, 10, 50)).toBe(40)
  })

  it('does not go below 0', () => {
    expect(deriveScrollOffset(0, 10, 50)).toBe(0)
  })

  it('handles edge case with viewport larger than items', () => {
    expect(deriveScrollOffset(0, 100, 10)).toBe(0)
  })

  it('handles single item', () => {
    expect(deriveScrollOffset(0, 10, 1)).toBe(0)
  })
})
