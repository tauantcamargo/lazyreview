import { describe, it, expect } from 'vitest'
import { computeVisibleSlice } from './useVirtualScroll'

describe('computeVisibleSlice', () => {
  const items = Array.from({ length: 100 }, (_, i) => `item-${i}`)

  describe('basic slicing', () => {
    it('returns all items when they fit in viewport', () => {
      const small = ['a', 'b', 'c']
      const result = computeVisibleSlice({
        items: small,
        viewportSize: 10,
        selectedIndex: 0,
      })
      expect(result.visibleItems).toEqual(small)
      expect(result.startIndex).toBe(0)
      expect(result.endIndex).toBe(3)
      expect(result.totalItems).toBe(3)
    })

    it('returns correct slice at the beginning', () => {
      const result = computeVisibleSlice({
        items,
        viewportSize: 10,
        selectedIndex: 0,
      })
      // scrollOffset=0, startIndex=0, endIndex=0+10+5=15
      expect(result.startIndex).toBe(0)
      expect(result.endIndex).toBe(15)
      expect(result.visibleItems.length).toBe(15)
      expect(result.visibleItems[0]).toBe('item-0')
    })

    it('returns correct slice in the middle', () => {
      const result = computeVisibleSlice({
        items,
        viewportSize: 10,
        selectedIndex: 50,
      })
      // scrollOffset = 50 - floor(10/2) = 45, clamped to max(0, min(45, 90)) = 45
      // startIndex = max(0, 45-5) = 40
      // endIndex = min(100, 45+10+5) = 60
      expect(result.startIndex).toBe(40)
      expect(result.endIndex).toBe(60)
      expect(result.visibleItems.length).toBe(20)
      expect(result.visibleItems[0]).toBe('item-40')
    })

    it('returns correct slice at the end', () => {
      const result = computeVisibleSlice({
        items,
        viewportSize: 10,
        selectedIndex: 99,
      })
      // scrollOffset = max(0, min(99-5, 90)) = 90
      // startIndex = max(0, 90-5) = 85
      // endIndex = min(100, 90+10+5) = 100
      expect(result.startIndex).toBe(85)
      expect(result.endIndex).toBe(100)
      expect(result.visibleItems.length).toBe(15)
      expect(result.visibleItems[result.visibleItems.length - 1]).toBe('item-99')
    })
  })

  describe('auto-scroll to selected index', () => {
    it('centers viewport on selected index', () => {
      const result = computeVisibleSlice({
        items,
        viewportSize: 20,
        selectedIndex: 50,
      })
      // scrollOffset = 50 - 10 = 40
      // The selected item should be within the visible range
      const selectedOffset = 50 - result.startIndex
      expect(selectedOffset).toBeGreaterThanOrEqual(0)
      expect(selectedOffset).toBeLessThan(result.visibleItems.length)
    })

    it('keeps selected index visible when near start', () => {
      const result = computeVisibleSlice({
        items,
        viewportSize: 20,
        selectedIndex: 3,
      })
      // scrollOffset would be max(0, 3-10) = 0
      expect(result.startIndex).toBe(0)
      expect(result.scrollOffset).toBe(0)
      // Item 3 should be in the visible range
      expect(result.visibleItems).toContain('item-3')
    })

    it('keeps selected index visible when near end', () => {
      const result = computeVisibleSlice({
        items,
        viewportSize: 20,
        selectedIndex: 98,
      })
      // scrollOffset would be min(98-10, 80) = 80
      expect(result.visibleItems).toContain('item-98')
    })
  })

  describe('overscan', () => {
    it('uses default overscan of 5', () => {
      const result = computeVisibleSlice({
        items,
        viewportSize: 10,
        selectedIndex: 50,
      })
      // scrollOffset=45, start=40, end=60 -> 20 items (10 viewport + 5+5 overscan)
      expect(result.visibleItems.length).toBe(20)
    })

    it('respects custom overscan', () => {
      const result = computeVisibleSlice({
        items,
        viewportSize: 10,
        selectedIndex: 50,
        overscan: 3,
      })
      // scrollOffset=45, start=42, end=58 -> 16 items (10 viewport + 3+3 overscan)
      expect(result.visibleItems.length).toBe(16)
    })

    it('works with zero overscan', () => {
      const result = computeVisibleSlice({
        items,
        viewportSize: 10,
        selectedIndex: 50,
        overscan: 0,
      })
      // scrollOffset=45, start=45, end=55 -> 10 items
      expect(result.visibleItems.length).toBe(10)
    })
  })

  describe('edge cases', () => {
    it('handles empty items array', () => {
      const result = computeVisibleSlice({
        items: [],
        viewportSize: 10,
        selectedIndex: 0,
      })
      expect(result.visibleItems).toEqual([])
      expect(result.startIndex).toBe(0)
      expect(result.endIndex).toBe(0)
      expect(result.scrollOffset).toBe(0)
      expect(result.totalItems).toBe(0)
    })

    it('handles single item', () => {
      const result = computeVisibleSlice({
        items: ['only'],
        viewportSize: 10,
        selectedIndex: 0,
      })
      expect(result.visibleItems).toEqual(['only'])
      expect(result.startIndex).toBe(0)
      expect(result.endIndex).toBe(1)
    })

    it('handles selectedIndex out of bounds', () => {
      const result = computeVisibleSlice({
        items: items.slice(0, 10),
        viewportSize: 5,
        selectedIndex: 20, // Out of bounds
      })
      // Should clamp to last item
      expect(result.visibleItems.length).toBeGreaterThan(0)
      expect(result.endIndex).toBeLessThanOrEqual(10)
    })

    it('handles negative selectedIndex', () => {
      const result = computeVisibleSlice({
        items,
        viewportSize: 10,
        selectedIndex: -5,
      })
      expect(result.startIndex).toBe(0)
      expect(result.visibleItems.length).toBeGreaterThan(0)
    })

    it('handles viewport size of 1', () => {
      const result = computeVisibleSlice({
        items,
        viewportSize: 1,
        selectedIndex: 50,
      })
      // Should still include overscan items
      expect(result.visibleItems.length).toBeGreaterThan(1)
      expect(result.visibleItems).toContain('item-50')
    })
  })

  describe('scrollOffset derivation', () => {
    it('returns correct scrollOffset at start', () => {
      const result = computeVisibleSlice({
        items,
        viewportSize: 10,
        selectedIndex: 0,
      })
      expect(result.scrollOffset).toBe(0)
    })

    it('returns correct scrollOffset in middle', () => {
      const result = computeVisibleSlice({
        items,
        viewportSize: 10,
        selectedIndex: 50,
      })
      // deriveScrollOffset(50, 10, 100) = max(0, min(50-5, 90)) = 45
      expect(result.scrollOffset).toBe(45)
    })

    it('returns correct scrollOffset at end', () => {
      const result = computeVisibleSlice({
        items,
        viewportSize: 10,
        selectedIndex: 99,
      })
      // deriveScrollOffset(99, 10, 100) = max(0, min(99-5, 90)) = 90
      expect(result.scrollOffset).toBe(90)
    })
  })

  describe('immutability', () => {
    it('does not mutate the input items array', () => {
      const original = [...items]
      computeVisibleSlice({
        items: original,
        viewportSize: 10,
        selectedIndex: 50,
      })
      expect(original).toEqual(items)
    })

    it('returns a new array (not the original)', () => {
      const small = ['a', 'b', 'c']
      const result = computeVisibleSlice({
        items: small,
        viewportSize: 10,
        selectedIndex: 0,
      })
      // When all items fit, we slice which creates a new array
      expect(result.visibleItems).not.toBe(small)
    })
  })

  describe('consistency with deriveScrollOffset', () => {
    it('scrollOffset matches what deriveScrollOffset would produce', () => {
      for (const idx of [0, 10, 25, 50, 75, 99]) {
        const result = computeVisibleSlice({
          items,
          viewportSize: 20,
          selectedIndex: idx,
        })
        // Manual derivation
        const expected = Math.max(
          0,
          Math.min(idx - Math.floor(20 / 2), 100 - 20),
        )
        expect(result.scrollOffset).toBe(expected)
      }
    })
  })
})
