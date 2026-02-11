import { describe, it, expect } from 'vitest'

// Test the pure pagination logic extracted from the hook
// Since usePagination is a React hook, we test the calculation logic directly

function calcTotalPages(itemCount: number, pageSize: number): number {
  return Math.max(1, Math.ceil(itemCount / pageSize))
}

function calcSafePage(currentPage: number, totalPages: number): number {
  return Math.min(currentPage, totalPages)
}

function calcStartIndex(safePage: number, pageSize: number): number {
  return (safePage - 1) * pageSize
}

function calcEndIndex(
  startIndex: number,
  pageSize: number,
  itemCount: number,
): number {
  return Math.min(startIndex + pageSize, itemCount)
}

function calcPageItems<T>(
  items: readonly T[],
  startIndex: number,
  endIndex: number,
): readonly T[] {
  return items.slice(startIndex, endIndex)
}

function clampPage(page: number, totalPages: number): number {
  return Math.max(1, Math.min(page, totalPages))
}

describe('usePagination logic', () => {
  const DEFAULT_PAGE_SIZE = 18

  describe('calcTotalPages', () => {
    it('returns 1 for empty items', () => {
      expect(calcTotalPages(0, DEFAULT_PAGE_SIZE)).toBe(1)
    })

    it('returns 1 when items fit in one page', () => {
      expect(calcTotalPages(10, DEFAULT_PAGE_SIZE)).toBe(1)
    })

    it('returns correct pages with default page size', () => {
      expect(calcTotalPages(50, DEFAULT_PAGE_SIZE)).toBe(3) // ceil(50/18)
    })

    it('returns correct pages with custom page size', () => {
      expect(calcTotalPages(50, 10)).toBe(5)
    })

    it('handles exact multiples', () => {
      expect(calcTotalPages(20, 10)).toBe(2)
    })

    it('rounds up for partial pages', () => {
      expect(calcTotalPages(21, 10)).toBe(3)
    })
  })

  describe('calcSafePage', () => {
    it('returns current page when within bounds', () => {
      expect(calcSafePage(2, 5)).toBe(2)
    })

    it('clamps to totalPages when current exceeds it', () => {
      expect(calcSafePage(10, 5)).toBe(5)
    })

    it('returns 1 when totalPages is 1', () => {
      expect(calcSafePage(3, 1)).toBe(1)
    })
  })

  describe('calcStartIndex and calcEndIndex', () => {
    it('returns 0 start for first page', () => {
      expect(calcStartIndex(1, 10)).toBe(0)
    })

    it('returns correct start for second page', () => {
      expect(calcStartIndex(2, 10)).toBe(10)
    })

    it('returns pageSize end for full first page', () => {
      expect(calcEndIndex(0, 10, 50)).toBe(10)
    })

    it('clamps end to item count on last page', () => {
      expect(calcEndIndex(40, 10, 45)).toBe(45)
    })

    it('handles items exactly filling the page', () => {
      expect(calcEndIndex(40, 10, 50)).toBe(50)
    })
  })

  describe('calcPageItems', () => {
    const items = Array.from({ length: 50 }, (_, i) => `item-${i}`)

    it('returns first page items', () => {
      const pageItems = calcPageItems(items, 0, 10)
      expect(pageItems).toHaveLength(10)
      expect(pageItems[0]).toBe('item-0')
      expect(pageItems[9]).toBe('item-9')
    })

    it('returns middle page items', () => {
      const pageItems = calcPageItems(items, 10, 20)
      expect(pageItems).toHaveLength(10)
      expect(pageItems[0]).toBe('item-10')
    })

    it('returns partial last page items', () => {
      const pageItems = calcPageItems(items, 40, 50)
      expect(pageItems).toHaveLength(10)
      expect(pageItems[0]).toBe('item-40')
    })

    it('returns empty for empty items', () => {
      const pageItems = calcPageItems([], 0, 0)
      expect(pageItems).toHaveLength(0)
    })
  })

  describe('clampPage', () => {
    it('returns page when within bounds', () => {
      expect(clampPage(3, 5)).toBe(3)
    })

    it('clamps to 1 for negative page', () => {
      expect(clampPage(-5, 5)).toBe(1)
    })

    it('clamps to 1 for zero page', () => {
      expect(clampPage(0, 5)).toBe(1)
    })

    it('clamps to totalPages for page exceeding total', () => {
      expect(clampPage(100, 5)).toBe(5)
    })

    it('returns 1 for single page', () => {
      expect(clampPage(1, 1)).toBe(1)
    })
  })

  describe('navigation flags', () => {
    it('has next page when not on last page', () => {
      const totalPages = calcTotalPages(50, 10)
      const safePage = calcSafePage(1, totalPages)
      expect(safePage < totalPages).toBe(true)
    })

    it('has no next page on last page', () => {
      const totalPages = calcTotalPages(50, 10)
      const safePage = calcSafePage(5, totalPages)
      expect(safePage < totalPages).toBe(false)
    })

    it('has no prev page on first page', () => {
      const safePage = calcSafePage(1, 5)
      expect(safePage > 1).toBe(false)
    })

    it('has prev page when not on first page', () => {
      const safePage = calcSafePage(3, 5)
      expect(safePage > 1).toBe(true)
    })
  })

  describe('full pagination flow', () => {
    const items = Array.from({ length: 45 }, (_, i) => `item-${i}`)
    const pageSize = 10

    it('paginates through all pages correctly', () => {
      const totalPages = calcTotalPages(items.length, pageSize)
      expect(totalPages).toBe(5)

      // Page 1
      const start1 = calcStartIndex(1, pageSize)
      const end1 = calcEndIndex(start1, pageSize, items.length)
      const page1 = calcPageItems(items, start1, end1)
      expect(page1).toHaveLength(10)
      expect(page1[0]).toBe('item-0')

      // Page 5 (last, partial)
      const start5 = calcStartIndex(5, pageSize)
      const end5 = calcEndIndex(start5, pageSize, items.length)
      const page5 = calcPageItems(items, start5, end5)
      expect(page5).toHaveLength(5) // 45 - 40 = 5
      expect(page5[0]).toBe('item-40')
      expect(page5[4]).toBe('item-44')
    })
  })
})
