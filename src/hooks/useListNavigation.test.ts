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

  it('handles exact viewport fit (itemCount equals viewportHeight)', () => {
    expect(deriveScrollOffset(5, 10, 10)).toBe(0)
  })

  it('handles selection at the very last item', () => {
    // selectedIndex=99, viewport=20, items=100
    // offset = 99 - 10 = 89, max = 100 - 20 = 80
    expect(deriveScrollOffset(99, 20, 100)).toBe(80)
  })

  it('handles selection at midpoint', () => {
    // selectedIndex=25, viewport=10, items=50
    // offset = 25 - 5 = 20
    expect(deriveScrollOffset(25, 10, 50)).toBe(20)
  })

  it('handles viewport of 1', () => {
    // selectedIndex=5, viewport=1, items=10
    // offset = 5 - 0 = 5, max = 10 - 1 = 9
    expect(deriveScrollOffset(5, 1, 10)).toBe(5)
  })

  it('handles viewport of 2', () => {
    // selectedIndex=5, viewport=2, items=10
    // offset = 5 - 1 = 4, max = 10 - 2 = 8
    expect(deriveScrollOffset(5, 2, 10)).toBe(4)
  })

  it('handles large lists efficiently', () => {
    // selectedIndex=5000, viewport=50, items=10000
    // offset = 5000 - 25 = 4975, max = 10000 - 50 = 9950
    expect(deriveScrollOffset(5000, 50, 10000)).toBe(4975)
  })

  it('returns 0 when itemCount is 0', () => {
    expect(deriveScrollOffset(0, 10, 0)).toBe(0)
  })

  it('clamps selection near end correctly', () => {
    // selectedIndex=47, viewport=10, items=50
    // offset = 47 - 5 = 42, max = 50 - 10 = 40
    expect(deriveScrollOffset(47, 10, 50)).toBe(40)
  })

  it('handles selection just above the half-viewport threshold', () => {
    // selectedIndex=6, viewport=10, items=50
    // offset = 6 - 5 = 1
    expect(deriveScrollOffset(6, 10, 50)).toBe(1)
  })
})
