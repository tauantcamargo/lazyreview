import { expandTabs, type DiffDisplayRow } from './DiffView'
import type { SideBySideRow } from './SideBySideDiffView'
import { stripAnsi } from '../../utils/sanitize'

/**
 * Compute the maximum line length in unified diff rows (for horizontal scroll).
 */
export function computeMaxDiffLineLength(
  allRows: readonly DiffDisplayRow[],
): number {
  let max = 0
  for (const row of allRows) {
    if (row.type === 'line') {
      const len = expandTabs(stripAnsi(row.line.content)).length
      if (len > max) max = len
    }
  }
  return max
}

/**
 * Compute the maximum line length in side-by-side diff rows (for horizontal scroll).
 */
export function computeMaxSbsLineLength(
  sideBySideRows: readonly SideBySideRow[],
): number {
  let max = 0
  for (const row of sideBySideRows) {
    if (row.type === 'paired' || row.type === 'header') {
      const left = row.type === 'header' ? row.left : row.left
      const right = row.type === 'paired' ? row.right : null
      if (left?.content) {
        const len = expandTabs(stripAnsi(left.content)).length
        if (len > max) max = len
      }
      if (right?.content) {
        const len = expandTabs(stripAnsi(right.content)).length
        if (len > max) max = len
      }
    }
  }
  return max
}
