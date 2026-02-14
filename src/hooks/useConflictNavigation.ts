import { useCallback, useEffect, useState } from 'react'
import type { ConflictRegion } from '../utils/three-way-diff'

/**
 * Pure function: compute the next conflict index, wrapping around.
 */
export function nextConflictIndex(current: number, total: number): number {
  if (total <= 1) return 0
  return (current + 1) % total
}

/**
 * Pure function: compute the previous conflict index, wrapping around.
 */
export function prevConflictIndex(current: number, total: number): number {
  if (total <= 1) return 0
  return (current - 1 + total) % total
}

/**
 * Pure function: clamp a conflict index to valid range.
 */
export function clampConflictIndex(index: number, total: number): number {
  if (total <= 0) return 0
  return Math.max(0, Math.min(index, total - 1))
}

interface UseConflictNavigationResult {
  readonly currentIndex: number
  readonly total: number
  readonly goNext: () => void
  readonly goPrev: () => void
}

/**
 * Hook for navigating between conflict regions in a three-way diff view.
 * Wraps around at both boundaries (last -> first, first -> last).
 * Clamps the index when the conflict list shrinks.
 *
 * @param conflicts - Array of conflict regions to navigate through
 * @param _isActive - Whether the hook should respond to navigation (reserved for keybinding integration)
 * @returns Navigation state and actions
 */
export function useConflictNavigation(
  conflicts: readonly ConflictRegion[],
  _isActive: boolean,
): UseConflictNavigationResult {
  const [currentIndex, setCurrentIndex] = useState(0)
  const total = conflicts.length

  // Clamp index when conflicts array changes
  useEffect(() => {
    setCurrentIndex((prev) => clampConflictIndex(prev, total))
  }, [total])

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => nextConflictIndex(prev, total))
  }, [total])

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => prevConflictIndex(prev, total))
  }, [total])

  return { currentIndex, total, goNext, goPrev }
}
