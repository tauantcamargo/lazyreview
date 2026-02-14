/**
 * Pure utility for diff hunk folding/collapsing.
 * Replaces folded hunk rows with a single placeholder that displays
 * "[+N lines folded]" in the diff view.
 */

import type { DiffDisplayRow } from '../components/pr/DiffView'

/** Placeholder row shown when a hunk is folded. */
export interface FoldedHunkPlaceholder {
  readonly type: 'folded'
  readonly hunkIndex: number
  readonly foldedLineCount: number
}

/** Row type that includes folded placeholders alongside normal rows. */
export type FoldableRow = DiffDisplayRow | FoldedHunkPlaceholder

/**
 * Apply hunk folding to a list of diff display rows.
 * Folded hunks are replaced with a single FoldedHunkPlaceholder.
 * Comment rows are considered part of the preceding hunk.
 *
 * @param rows - The original diff display rows from buildDiffRows
 * @param foldedHunks - Set of hunk indices to fold
 * @returns New array with folded hunks replaced by placeholders
 */
export function applyHunkFolding(
  rows: readonly DiffDisplayRow[],
  foldedHunks: ReadonlySet<number>,
): readonly FoldableRow[] {
  if (foldedHunks.size === 0) return rows as readonly FoldableRow[]
  if (rows.length === 0) return []

  const result: FoldableRow[] = []
  let currentHunkIndex = -1
  let isFolding = false
  let foldedLineCount = 0

  for (const row of rows) {
    if (row.type === 'line') {
      const hunkIdx = row.hunkIndex

      // Check if we're entering a new hunk
      if (hunkIdx !== currentHunkIndex) {
        // Flush previous folded hunk placeholder
        if (isFolding && foldedLineCount > 0) {
          result.push({
            type: 'folded',
            hunkIndex: currentHunkIndex,
            foldedLineCount,
          })
        }

        currentHunkIndex = hunkIdx
        isFolding = foldedHunks.has(hunkIdx)
        foldedLineCount = 0
      }

      if (isFolding) {
        foldedLineCount++
      } else {
        result.push(row)
      }
    } else if (row.type === 'comment') {
      // Comment rows belong to the preceding hunk
      if (isFolding) {
        // Skip (don't count comments in foldedLineCount)
      } else {
        result.push(row)
      }
    }
  }

  // Flush any remaining folded hunk
  if (isFolding && foldedLineCount > 0) {
    result.push({
      type: 'folded',
      hunkIndex: currentHunkIndex,
      foldedLineCount,
    })
  }

  return result
}

/**
 * Toggle fold state for a hunk. Returns a new Set (immutable).
 *
 * @param foldedHunks - Current set of folded hunk indices
 * @param hunkIndex - The hunk index to toggle
 * @returns New Set with the hunk toggled
 */
export function toggleHunkFold(
  foldedHunks: ReadonlySet<number>,
  hunkIndex: number,
): ReadonlySet<number> {
  const next = new Set(foldedHunks)
  if (next.has(hunkIndex)) {
    next.delete(hunkIndex)
  } else {
    next.add(hunkIndex)
  }
  return next
}

/**
 * Get the hunk index for a row at a given position.
 * Works with both regular DiffDisplayRows and FoldedHunkPlaceholders.
 *
 * @param rows - The (possibly folded) row array
 * @param rowIndex - The index in the rows array
 * @returns The hunk index, or -1 if not a line/folded row or out of bounds
 */
export function getHunkIndexForRow(
  rows: readonly FoldableRow[],
  rowIndex: number,
): number {
  const row = rows[rowIndex]
  if (!row) return -1

  if (row.type === 'line') {
    return row.hunkIndex
  }

  if (row.type === 'folded') {
    return row.hunkIndex
  }

  // Comment rows don't have a direct hunkIndex
  return -1
}
