import { describe, it, expect } from 'vitest'
import { computeVirtualWindow } from './virtual-window'

describe('computeVirtualWindow', () => {
  describe('basic windowing', () => {
    it('returns full range when items fit within viewport', () => {
      const result = computeVirtualWindow({
        totalItems: 5,
        viewportSize: 10,
        scrollOffset: 0,
      })
      expect(result.startIndex).toBe(0)
      expect(result.endIndex).toBe(5)
      expect(result.visibleRange).toEqual([0, 1, 2, 3, 4])
      expect(result.paddingTop).toBe(0)
      expect(result.paddingBottom).toBe(0)
    })

    it('returns correct window at the beginning', () => {
      const result = computeVirtualWindow({
        totalItems: 100,
        viewportSize: 10,
        scrollOffset: 0,
      })
      expect(result.startIndex).toBe(0)
      expect(result.endIndex).toBe(15) // 10 viewport + 5 overscan
      expect(result.paddingTop).toBe(0)
      expect(result.paddingBottom).toBe(85) // 100 - 15
    })

    it('returns correct window in the middle', () => {
      const result = computeVirtualWindow({
        totalItems: 100,
        viewportSize: 10,
        scrollOffset: 50,
      })
      expect(result.startIndex).toBe(45) // 50 - 5 overscan
      expect(result.endIndex).toBe(65) // 50 + 10 + 5 overscan
      expect(result.paddingTop).toBe(45)
      expect(result.paddingBottom).toBe(35) // 100 - 65
    })

    it('returns correct window at the end', () => {
      const result = computeVirtualWindow({
        totalItems: 100,
        viewportSize: 10,
        scrollOffset: 90,
      })
      expect(result.startIndex).toBe(85) // 90 - 5 overscan
      expect(result.endIndex).toBe(100)
      expect(result.paddingTop).toBe(85)
      expect(result.paddingBottom).toBe(0)
    })
  })

  describe('overscan', () => {
    it('uses default overscan of 5', () => {
      const result = computeVirtualWindow({
        totalItems: 100,
        viewportSize: 10,
        scrollOffset: 50,
      })
      // With 5 overscan: 50-5=45 to 50+10+5=65
      expect(result.startIndex).toBe(45)
      expect(result.endIndex).toBe(65)
    })

    it('respects custom overscan', () => {
      const result = computeVirtualWindow({
        totalItems: 100,
        viewportSize: 10,
        scrollOffset: 50,
        overscan: 10,
      })
      // With 10 overscan: 50-10=40 to 50+10+10=70
      expect(result.startIndex).toBe(40)
      expect(result.endIndex).toBe(70)
    })

    it('handles zero overscan', () => {
      const result = computeVirtualWindow({
        totalItems: 100,
        viewportSize: 10,
        scrollOffset: 50,
        overscan: 0,
      })
      expect(result.startIndex).toBe(50)
      expect(result.endIndex).toBe(60)
    })

    it('clamps overscan at boundaries', () => {
      const result = computeVirtualWindow({
        totalItems: 100,
        viewportSize: 10,
        scrollOffset: 2,
        overscan: 10,
      })
      // Cannot go below 0
      expect(result.startIndex).toBe(0)
      expect(result.endIndex).toBe(22) // 2 + 10 + 10
    })

    it('clamps overscan at the end', () => {
      const result = computeVirtualWindow({
        totalItems: 100,
        viewportSize: 10,
        scrollOffset: 95,
        overscan: 10,
      })
      // scrollOffset clamped to max (90), then 90 - 10 overscan = 80
      expect(result.startIndex).toBe(80)
      expect(result.endIndex).toBe(100) // Cannot exceed totalItems
    })
  })

  describe('edge cases', () => {
    it('handles empty list', () => {
      const result = computeVirtualWindow({
        totalItems: 0,
        viewportSize: 10,
        scrollOffset: 0,
      })
      expect(result.startIndex).toBe(0)
      expect(result.endIndex).toBe(0)
      expect(result.visibleRange).toEqual([])
      expect(result.paddingTop).toBe(0)
      expect(result.paddingBottom).toBe(0)
    })

    it('handles single item', () => {
      const result = computeVirtualWindow({
        totalItems: 1,
        viewportSize: 10,
        scrollOffset: 0,
      })
      expect(result.startIndex).toBe(0)
      expect(result.endIndex).toBe(1)
      expect(result.visibleRange).toEqual([0])
      expect(result.paddingTop).toBe(0)
      expect(result.paddingBottom).toBe(0)
    })

    it('handles viewport of 1', () => {
      const result = computeVirtualWindow({
        totalItems: 100,
        viewportSize: 1,
        scrollOffset: 50,
      })
      expect(result.startIndex).toBe(45) // 50 - 5
      expect(result.endIndex).toBe(56) // 50 + 1 + 5
    })

    it('handles negative scrollOffset by clamping to 0', () => {
      const result = computeVirtualWindow({
        totalItems: 100,
        viewportSize: 10,
        scrollOffset: -5,
      })
      expect(result.startIndex).toBe(0)
      expect(result.endIndex).toBe(15) // 0 + 10 + 5
    })

    it('handles scrollOffset beyond totalItems by clamping', () => {
      const result = computeVirtualWindow({
        totalItems: 100,
        viewportSize: 10,
        scrollOffset: 200,
      })
      // Scroll offset clamped to max valid: 100 - 10 = 90
      expect(result.startIndex).toBe(85)
      expect(result.endIndex).toBe(100)
    })

    it('handles viewport larger than total items', () => {
      const result = computeVirtualWindow({
        totalItems: 5,
        viewportSize: 100,
        scrollOffset: 0,
      })
      expect(result.startIndex).toBe(0)
      expect(result.endIndex).toBe(5)
      expect(result.paddingTop).toBe(0)
      expect(result.paddingBottom).toBe(0)
    })
  })

  describe('visibleRange', () => {
    it('returns correct range of indices', () => {
      const result = computeVirtualWindow({
        totalItems: 20,
        viewportSize: 5,
        scrollOffset: 10,
        overscan: 2,
      })
      // startIndex=8, endIndex=17
      expect(result.visibleRange).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16])
    })

    it('returns all indices when list is small', () => {
      const result = computeVirtualWindow({
        totalItems: 3,
        viewportSize: 10,
        scrollOffset: 0,
      })
      expect(result.visibleRange).toEqual([0, 1, 2])
    })
  })

  describe('padding calculations', () => {
    it('calculates correct padding for middle position', () => {
      const result = computeVirtualWindow({
        totalItems: 100,
        viewportSize: 10,
        scrollOffset: 50,
        overscan: 5,
      })
      expect(result.paddingTop).toBe(45)
      expect(result.paddingBottom).toBe(35)
      // paddingTop + visibleRange.length + paddingBottom should equal totalItems
      expect(result.paddingTop + result.visibleRange.length + result.paddingBottom).toBe(100)
    })

    it('has zero paddingTop at start', () => {
      const result = computeVirtualWindow({
        totalItems: 100,
        viewportSize: 10,
        scrollOffset: 0,
      })
      expect(result.paddingTop).toBe(0)
    })

    it('has zero paddingBottom at end', () => {
      const result = computeVirtualWindow({
        totalItems: 100,
        viewportSize: 10,
        scrollOffset: 90,
      })
      expect(result.paddingBottom).toBe(0)
    })

    it('total items equals paddingTop + visibleRange + paddingBottom', () => {
      // Test with several positions
      for (const offset of [0, 10, 25, 50, 75, 90]) {
        const result = computeVirtualWindow({
          totalItems: 100,
          viewportSize: 10,
          scrollOffset: offset,
        })
        expect(
          result.paddingTop + result.visibleRange.length + result.paddingBottom,
        ).toBe(100)
      }
    })
  })

  describe('large lists', () => {
    it('handles 10000 items efficiently', () => {
      const start = performance.now()
      const result = computeVirtualWindow({
        totalItems: 10000,
        viewportSize: 50,
        scrollOffset: 5000,
      })
      const elapsed = performance.now() - start
      expect(elapsed).toBeLessThan(10) // Should be near-instant
      expect(result.visibleRange.length).toBe(60) // 50 viewport + 5 + 5 overscan
    })

    it('handles 100000 items without issues', () => {
      const result = computeVirtualWindow({
        totalItems: 100000,
        viewportSize: 50,
        scrollOffset: 50000,
      })
      expect(result.startIndex).toBe(49995)
      expect(result.endIndex).toBe(50055)
      expect(result.visibleRange.length).toBe(60)
    })
  })
})
