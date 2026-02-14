/**
 * Virtual scroll hook for rendering only visible items from large lists.
 *
 * Wraps the pure computeVirtualWindow utility with scroll offset derivation
 * to auto-scroll and keep the selected index in view.
 */

import { useMemo } from 'react'
import { computeVirtualWindow } from '../utils/virtual-window'
import { deriveScrollOffset } from './useListNavigation'

interface UseVirtualScrollOptions<T> {
  readonly items: readonly T[]
  readonly viewportSize: number
  readonly selectedIndex: number
  readonly overscan?: number
}

interface UseVirtualScrollResult<T> {
  readonly visibleItems: readonly T[]
  readonly startIndex: number
  readonly endIndex: number
  readonly scrollOffset: number
  readonly totalItems: number
}

/**
 * Pure function that computes the visible slice of items for virtual scrolling.
 *
 * Derives the scroll offset from the selected index (centering the selection
 * in the viewport), then uses computeVirtualWindow to determine the visible
 * range including overscan buffer.
 *
 * Exported for direct testing without React hook overhead.
 */
export function computeVisibleSlice<T>(options: UseVirtualScrollOptions<T>): UseVirtualScrollResult<T> {
  const { items, viewportSize, overscan } = options
  const totalItems = items.length

  if (totalItems === 0) {
    return {
      visibleItems: [],
      startIndex: 0,
      endIndex: 0,
      scrollOffset: 0,
      totalItems: 0,
    }
  }

  // Clamp selectedIndex to valid range
  const selectedIndex = Math.max(0, Math.min(options.selectedIndex, totalItems - 1))

  // Derive scroll offset to keep selection centered in viewport
  const scrollOffset = deriveScrollOffset(selectedIndex, viewportSize, totalItems)

  // Compute the virtual window with overscan
  const window = computeVirtualWindow({
    totalItems,
    viewportSize,
    scrollOffset,
    overscan,
  })

  // Slice the items array to only include visible items
  const visibleItems = items.slice(window.startIndex, window.endIndex)

  return {
    visibleItems,
    startIndex: window.startIndex,
    endIndex: window.endIndex,
    scrollOffset,
    totalItems,
  }
}

/**
 * React hook for virtual scrolling.
 *
 * Auto-scrolls to keep selectedIndex in view and returns only the visible
 * slice of items (plus overscan buffer) for rendering.
 *
 * @param options - Virtual scroll options including items, viewport size, and selected index
 * @returns The visible items slice, indices, and scroll offset
 */
export function useVirtualScroll<T>(
  options: UseVirtualScrollOptions<T>,
): UseVirtualScrollResult<T> {
  const { items, viewportSize, selectedIndex, overscan } = options

  return useMemo(
    () => computeVisibleSlice({ items, viewportSize, selectedIndex, overscan }),
    [items, viewportSize, selectedIndex, overscan],
  )
}
