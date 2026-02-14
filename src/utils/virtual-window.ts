/**
 * Pure utility for computing a virtual scroll window.
 * Determines which items from a large list should be rendered
 * based on the current scroll position and viewport size.
 */

export interface VirtualWindowConfig {
  readonly totalItems: number
  readonly viewportSize: number
  readonly scrollOffset: number
  readonly overscan?: number
}

export interface VirtualWindowResult {
  readonly startIndex: number
  readonly endIndex: number
  readonly visibleRange: readonly number[]
  readonly paddingTop: number
  readonly paddingBottom: number
}

const DEFAULT_OVERSCAN = 5

/**
 * Compute the visible window of items for virtual scrolling.
 *
 * Given a total item count, viewport size, and current scroll offset,
 * returns the range of indices that should be rendered (including overscan
 * buffer above and below the viewport for smooth scrolling).
 *
 * This is a pure function with no side effects -- all state is derived
 * from the inputs.
 *
 * @param config - Virtual window configuration
 * @returns The computed virtual window with start/end indices, visible range, and padding
 */
export function computeVirtualWindow(
  config: VirtualWindowConfig,
): VirtualWindowResult {
  const { totalItems, viewportSize } = config
  const overscan = config.overscan ?? DEFAULT_OVERSCAN

  if (totalItems === 0) {
    return {
      startIndex: 0,
      endIndex: 0,
      visibleRange: [],
      paddingTop: 0,
      paddingBottom: 0,
    }
  }

  // Clamp scrollOffset to valid range
  const maxOffset = Math.max(0, totalItems - viewportSize)
  const clampedOffset = Math.max(0, Math.min(config.scrollOffset, maxOffset))

  // Compute start/end with overscan buffer, clamped to bounds
  const startIndex = Math.max(0, clampedOffset - overscan)
  const endIndex = Math.min(totalItems, clampedOffset + viewportSize + overscan)

  // Build visible range array
  const rangeLength = endIndex - startIndex
  const visibleRange: number[] = new Array(rangeLength)
  for (let i = 0; i < rangeLength; i++) {
    visibleRange[i] = startIndex + i
  }

  const paddingTop = startIndex
  const paddingBottom = totalItems - endIndex

  return {
    startIndex,
    endIndex,
    visibleRange,
    paddingTop,
    paddingBottom,
  }
}
