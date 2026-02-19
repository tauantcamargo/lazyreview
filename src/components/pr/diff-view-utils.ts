import type { Hunk, DiffLine } from '../../models/diff'
import type { DiffCommentThread } from './DiffComment'
import { computeWordDiff, type WordDiffSegment } from '../../utils/word-diff'

/**
 * Expand tab characters to spaces using tab stops.
 * Ensures character count matches terminal column count for correct slicing.
 */
export function expandTabs(text: string, tabWidth: number = 4): string {
  if (!text.includes('\t')) return text
  let result = ''
  let col = 0
  for (const char of text) {
    if (char === '\t') {
      const spaces = tabWidth - (col % tabWidth)
      result += ' '.repeat(spaces)
      col += spaces
    } else {
      result += char
      col++
    }
  }
  return result
}

/**
 * Returns the display line number for a diff line.
 * - add/context lines: newLineNumber (RIGHT side)
 * - del lines: oldLineNumber (LEFT side)
 * - header lines: undefined (no line number)
 */
export function getDiffLineNumber(line: DiffLine): number | undefined {
  switch (line.type) {
    case 'add':
    case 'context':
      return line.newLineNumber
    case 'del':
      return line.oldLineNumber
    case 'header':
      return undefined
  }
}

/**
 * Returns the comment lookup key for a diff line.
 * Format: "SIDE:lineNumber" where SIDE is LEFT for deletions, RIGHT for additions/context.
 */
function getCommentKey(line: DiffLine): string | undefined {
  switch (line.type) {
    case 'del':
      return line.oldLineNumber != null
        ? `LEFT:${line.oldLineNumber}`
        : undefined
    case 'add':
      return line.newLineNumber != null
        ? `RIGHT:${line.newLineNumber}`
        : undefined
    case 'context':
      return line.newLineNumber != null
        ? `RIGHT:${line.newLineNumber}`
        : undefined
    case 'header':
      return undefined
  }
}

/**
 * Slice word-diff segments to fit within a visible window defined by
 * scrollOffsetX and contentWidth. Preserves segment types while trimming text.
 */
export function sliceWordDiffSegments(
  segments: readonly WordDiffSegment[],
  scrollOffsetX: number,
  contentWidth: number,
): readonly WordDiffSegment[] {
  const result: WordDiffSegment[] = []
  let pos = 0
  const end = scrollOffsetX + contentWidth

  for (const seg of segments) {
    const segEnd = pos + seg.text.length
    if (segEnd <= scrollOffsetX) {
      pos = segEnd
      continue
    }
    if (pos >= end) break

    const sliceStart = Math.max(0, scrollOffsetX - pos)
    const sliceEnd = Math.min(seg.text.length, end - pos)
    const text = seg.text.slice(sliceStart, sliceEnd)
    if (text.length > 0) {
      result.push({ text, type: seg.type })
    }
    pos = segEnd
  }

  return result
}

export type DiffDisplayRow =
  | {
      readonly type: 'line'
      readonly line: DiffLine
      readonly lineNumber: number | undefined
      readonly oldLineNumber: number | undefined
      readonly newLineNumber: number | undefined
      readonly hunkIndex: number
      readonly wordDiffSegments?: readonly WordDiffSegment[]
    }
  | { readonly type: 'comment'; readonly thread: DiffCommentThread }

/**
 * Compute indices of diff rows whose content matches the given query.
 * Only code lines (add, del, context) are matched; header and comment rows are skipped.
 */
export function computeDiffSearchMatches(
  rows: readonly DiffDisplayRow[],
  query: string,
): readonly number[] {
  if (!query) return []
  const lowerQuery = query.toLowerCase()
  const matches: number[] = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (row.type === 'line' && row.line.type !== 'header') {
      if (row.line.content.toLowerCase().includes(lowerQuery)) {
        matches.push(i)
      }
    }
  }
  return matches
}

/**
 * Annotate consecutive del/add line pairs with word-level diff segments.
 * Scans through rows, finds del lines immediately followed by add lines (ignoring comments),
 * pairs them up, and computes word diffs.
 */
function annotateWordDiffs(rows: DiffDisplayRow[]): DiffDisplayRow[] {
  const result: DiffDisplayRow[] = [...rows]

  let i = 0
  while (i < result.length) {
    const delStart = i
    while (
      i < result.length &&
      result[i].type === 'line' &&
      (result[i] as { type: 'line'; line: DiffLine }).line.type === 'del'
    ) {
      i++
    }
    const delEnd = i

    while (i < result.length && result[i].type === 'comment') {
      i++
    }

    const addStart = i
    while (
      i < result.length &&
      result[i].type === 'line' &&
      (result[i] as { type: 'line'; line: DiffLine }).line.type === 'add'
    ) {
      i++
    }
    const addEnd = i

    const delCount = delEnd - delStart
    const addCount = addEnd - addStart

    if (delCount > 0 && addCount > 0) {
      const pairCount = Math.min(delCount, addCount)
      for (let p = 0; p < pairCount; p++) {
        const delRow = result[delStart + p]
        const addRow = result[addStart + p]
        if (delRow.type !== 'line' || addRow.type !== 'line') continue

        const diff = computeWordDiff(delRow.line.content, addRow.line.content)

        const hasEqual = diff.oldSegments.some((s) => s.type === 'equal')
        const hasChanged = diff.oldSegments.some((s) => s.type === 'changed')
        if (hasEqual && hasChanged) {
          result[delStart + p] = {
            ...delRow,
            wordDiffSegments: diff.oldSegments,
          }
          result[addStart + p] = {
            ...addRow,
            wordDiffSegments: diff.newSegments,
          }
        }
      }
    }

    if (delStart === delEnd && addStart === addEnd) {
      i++
    }
  }

  return result
}

export function buildDiffRows(
  hunks: readonly Hunk[],
  commentsByLine?: ReadonlyMap<string, DiffCommentThread>,
): DiffDisplayRow[] {
  const rows: DiffDisplayRow[] = []

  for (let hunkIndex = 0; hunkIndex < hunks.length; hunkIndex++) {
    const hunk = hunks[hunkIndex]
    for (const line of hunk.lines) {
      const lineNumber = getDiffLineNumber(line)
      rows.push({
        type: 'line',
        line,
        lineNumber,
        oldLineNumber: line.oldLineNumber,
        newLineNumber: line.newLineNumber,
        hunkIndex,
      })

      if (commentsByLine && line.type !== 'header') {
        const key = getCommentKey(line)
        if (key) {
          const thread = commentsByLine.get(key)
          if (thread) {
            rows.push({ type: 'comment', thread })
          }
        }
        if (line.type === 'context' && line.oldLineNumber != null) {
          const leftKey = `LEFT:${line.oldLineNumber}`
          const thread = commentsByLine.get(leftKey)
          if (thread) {
            rows.push({ type: 'comment', thread })
          }
        }
      }
    }
  }

  return annotateWordDiffs(rows)
}
