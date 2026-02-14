import type { DiffDisplayRow } from './DiffView'
import type { SideBySideRow } from './SideBySideDiffView'

/**
 * Check whether a unified diff row represents a changed line (add or del).
 */
function isChangedRow(row: DiffDisplayRow): boolean {
  return (
    row.type === 'line' &&
    (row.line.type === 'add' || row.line.type === 'del')
  )
}

/**
 * Check whether a side-by-side row represents a changed line (add or del on either side).
 */
function isSbsChangedRow(row: SideBySideRow): boolean {
  if (row.type === 'comment' || row.type === 'header') return false
  const leftType = row.left?.type
  const rightType = row.right?.type
  return (
    leftType === 'add' ||
    leftType === 'del' ||
    rightType === 'add' ||
    rightType === 'del'
  )
}

/**
 * Collect the indices of the first changed line in each hunk group.
 * A hunk group is identified by contiguous rows sharing the same hunkIndex
 * in unified mode. Within each group, we want the index of the first
 * add/del line.
 */
function collectHunkStarts(rows: readonly DiffDisplayRow[]): readonly number[] {
  const starts: number[] = []
  let lastHunkIndex = -1

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (row.type !== 'line') continue
    if (row.hunkIndex !== lastHunkIndex) {
      lastHunkIndex = row.hunkIndex
      // Find the first changed line in this hunk
      for (let j = i; j < rows.length; j++) {
        const candidate = rows[j]
        if (candidate.type === 'line' && candidate.hunkIndex !== row.hunkIndex) break
        if (isChangedRow(candidate)) {
          starts.push(j)
          break
        }
      }
    }
  }
  return starts
}

/**
 * Get the hunk index for a given row position. Returns -1 for comment rows
 * or if the row is a header but belongs to a hunk, returns that hunk's index.
 */
function getHunkIndexAt(
  rows: readonly DiffDisplayRow[],
  index: number,
): number {
  const row = rows[index]
  if (!row) return -1
  if (row.type === 'line') return row.hunkIndex
  // For comment rows, look at surrounding lines to determine hunk
  for (let i = index - 1; i >= 0; i--) {
    const prev = rows[i]
    if (prev.type === 'line') return prev.hunkIndex
  }
  return -1
}

/**
 * Find the row index of the next hunk's first changed line after the current index.
 * Skips the current hunk entirely, wraps around to the beginning when reaching the end.
 * Returns -1 if there are no changed lines or only one hunk with changes.
 */
export function findNextHunkStart(
  rows: readonly DiffDisplayRow[],
  currentIndex: number,
): number {
  if (rows.length === 0) return -1

  const starts = collectHunkStarts(rows)
  if (starts.length === 0) return -1
  if (starts.length === 1) {
    // Only one hunk with changes -- jump to its start (useful for single-hunk diffs)
    return starts[0]
  }

  const currentHunkIdx = getHunkIndexAt(rows, currentIndex)

  // Find the first hunk start that belongs to a different hunk and is after currentIndex
  for (const start of starts) {
    if (start > currentIndex) {
      const row = rows[start]
      if (row?.type === 'line' && row.hunkIndex !== currentHunkIdx) {
        return start
      }
    }
  }

  // Wrap around: return the first hunk start that is in a different hunk
  for (const start of starts) {
    const row = rows[start]
    if (row?.type === 'line' && row.hunkIndex !== currentHunkIdx) {
      return start
    }
  }

  // All starts are in the same hunk (should not happen with starts.length > 1)
  return starts[0]
}

/**
 * Find the row index of the previous hunk's first changed line before the current index.
 * Skips the current hunk entirely, wraps around to the end when reaching the beginning.
 * Returns -1 if there are no changed lines.
 */
export function findPrevHunkStart(
  rows: readonly DiffDisplayRow[],
  currentIndex: number,
): number {
  if (rows.length === 0) return -1

  const starts = collectHunkStarts(rows)
  if (starts.length === 0) return -1
  if (starts.length === 1) {
    return starts[0]
  }

  const currentHunkIdx = getHunkIndexAt(rows, currentIndex)

  // Find the last hunk start before currentIndex that is in a different hunk
  for (let i = starts.length - 1; i >= 0; i--) {
    if (starts[i] < currentIndex) {
      const row = rows[starts[i]]
      if (row?.type === 'line' && row.hunkIndex !== currentHunkIdx) {
        return starts[i]
      }
    }
  }

  // Wrap around: return the last hunk start that is in a different hunk
  for (let i = starts.length - 1; i >= 0; i--) {
    const row = rows[starts[i]]
    if (row?.type === 'line' && row.hunkIndex !== currentHunkIdx) {
      return starts[i]
    }
  }

  return starts[starts.length - 1]
}

/**
 * Find the row index matching a given line number in unified diff rows.
 * Checks both new and old line numbers. Returns the first match.
 * Returns -1 if not found.
 */
export function findRowByLineNumber(
  rows: readonly DiffDisplayRow[],
  lineNumber: number,
): number {
  if (rows.length === 0) return -1

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (row.type !== 'line') continue
    if (row.line.type === 'header') continue
    if (row.newLineNumber === lineNumber || row.oldLineNumber === lineNumber) {
      return i
    }
  }
  return -1
}

/**
 * Collect hunk start indices for side-by-side rows.
 * Since SideBySideRow does not have a hunkIndex, we detect hunk boundaries
 * by looking for header rows.
 */
function collectSbsHunkStarts(
  rows: readonly SideBySideRow[],
): readonly number[] {
  const starts: number[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (row.type === 'header') {
      // Find the first changed line after this header
      for (let j = i + 1; j < rows.length; j++) {
        const candidate = rows[j]
        if (candidate.type === 'header') break
        if (isSbsChangedRow(candidate)) {
          starts.push(j)
          break
        }
      }
    }
  }
  return starts
}

/**
 * Get the hunk section index for a side-by-side row.
 * Headers act as boundaries; returns the index of the most recent header before position.
 */
function getSbsHunkSection(
  rows: readonly SideBySideRow[],
  index: number,
): number {
  for (let i = index; i >= 0; i--) {
    if (rows[i]?.type === 'header') return i
  }
  return -1
}

/**
 * Find the next hunk start in side-by-side rows.
 * Returns -1 if there are no changed lines.
 */
export function findNextSbsHunkStart(
  rows: readonly SideBySideRow[],
  currentIndex: number,
): number {
  if (rows.length === 0) return -1

  const starts = collectSbsHunkStarts(rows)
  if (starts.length === 0) return -1
  if (starts.length === 1) return starts[0]

  const currentSection = getSbsHunkSection(rows, currentIndex)

  for (const start of starts) {
    if (start > currentIndex) {
      const section = getSbsHunkSection(rows, start)
      if (section !== currentSection) return start
    }
  }

  // Wrap around
  for (const start of starts) {
    const section = getSbsHunkSection(rows, start)
    if (section !== currentSection) return start
  }

  return starts[0]
}

/**
 * Find the previous hunk start in side-by-side rows.
 * Returns -1 if there are no changed lines.
 */
export function findPrevSbsHunkStart(
  rows: readonly SideBySideRow[],
  currentIndex: number,
): number {
  if (rows.length === 0) return -1

  const starts = collectSbsHunkStarts(rows)
  if (starts.length === 0) return -1
  if (starts.length === 1) return starts[0]

  const currentSection = getSbsHunkSection(rows, currentIndex)

  for (let i = starts.length - 1; i >= 0; i--) {
    if (starts[i] < currentIndex) {
      const section = getSbsHunkSection(rows, starts[i])
      if (section !== currentSection) return starts[i]
    }
  }

  // Wrap around
  for (let i = starts.length - 1; i >= 0; i--) {
    const section = getSbsHunkSection(rows, starts[i])
    if (section !== currentSection) return starts[i]
  }

  return starts[starts.length - 1]
}

/**
 * Find a row by line number in side-by-side rows.
 * Checks both left (old) and right (new) line numbers.
 * Returns -1 if not found.
 */
export function findSbsRowByLineNumber(
  rows: readonly SideBySideRow[],
  lineNumber: number,
): number {
  if (rows.length === 0) return -1

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (row.type === 'comment') continue
    if (row.type === 'header') continue

    const leftNum = row.left?.type === 'del' || row.left?.type === 'context'
      ? row.left.oldLineNumber
      : row.left?.newLineNumber
    const rightNum = row.right?.type === 'add' || row.right?.type === 'context'
      ? row.right.newLineNumber
      : row.right?.oldLineNumber

    if (leftNum === lineNumber || rightNum === lineNumber) {
      return i
    }
  }
  return -1
}
