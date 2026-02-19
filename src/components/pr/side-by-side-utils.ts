import type { Hunk, DiffLine } from '../../models/diff'
import type { DiffCommentThread } from './DiffComment'
import { computeWordDiff, type WordDiffSegment } from '../../utils/word-diff'

export type SideBySideRow =
  | {
      readonly left: DiffLine | null
      readonly right: DiffLine | null
      readonly type: 'paired' | 'header'
      readonly leftWordDiff?: readonly WordDiffSegment[]
      readonly rightWordDiff?: readonly WordDiffSegment[]
    }
  | {
      readonly type: 'comment'
      readonly thread: DiffCommentThread
    }

/**
 * Get the comment lookup key for a diff line in side-by-side context.
 */
function getSbsCommentKey(line: DiffLine): string | undefined {
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
 * Insert a comment row if there is a matching comment for the given line.
 */
function maybeInsertComment(
  rows: SideBySideRow[],
  line: DiffLine,
  commentsByLine?: ReadonlyMap<string, DiffCommentThread>,
): void {
  if (!commentsByLine) return
  const key = getSbsCommentKey(line)
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

/**
 * Compute word-diff for a paired del/add and return the segment arrays,
 * or undefined if the lines are too different or identical.
 */
function computePairWordDiff(
  delLine: DiffLine,
  addLine: DiffLine,
):
  | { left: readonly WordDiffSegment[]; right: readonly WordDiffSegment[] }
  | undefined {
  const diff = computeWordDiff(delLine.content, addLine.content)
  const hasEqual = diff.oldSegments.some((s) => s.type === 'equal')
  const hasChanged = diff.oldSegments.some((s) => s.type === 'changed')
  if (hasEqual && hasChanged) {
    return { left: diff.oldSegments, right: diff.newSegments }
  }
  return undefined
}

/**
 * Build side-by-side rows from hunks by pairing deletions with additions.
 * Context lines appear on both sides. Unmatched dels/adds get an empty opposite side.
 * When commentsByLine is provided, comment rows are inserted after matching lines.
 * Paired del/add lines get word-level diff annotations.
 */
export function buildSideBySideRows(
  hunks: readonly Hunk[],
  commentsByLine?: ReadonlyMap<string, DiffCommentThread>,
): readonly SideBySideRow[] {
  const rows: SideBySideRow[] = []

  for (const hunk of hunks) {
    const pendingDels: DiffLine[] = []
    const pendingAdds: DiffLine[] = []

    const flushPending = (): void => {
      const maxLen = Math.max(pendingDels.length, pendingAdds.length)
      for (let i = 0; i < maxLen; i++) {
        const leftLine = pendingDels[i] ?? null
        const rightLine = pendingAdds[i] ?? null

        let leftWordDiff: readonly WordDiffSegment[] | undefined
        let rightWordDiff: readonly WordDiffSegment[] | undefined
        if (
          leftLine &&
          rightLine &&
          leftLine.type === 'del' &&
          rightLine.type === 'add'
        ) {
          const pairDiff = computePairWordDiff(leftLine, rightLine)
          if (pairDiff) {
            leftWordDiff = pairDiff.left
            rightWordDiff = pairDiff.right
          }
        }

        rows.push({
          left: leftLine,
          right: rightLine,
          type: 'paired',
          leftWordDiff,
          rightWordDiff,
        })
        if (leftLine) maybeInsertComment(rows, leftLine, commentsByLine)
        if (rightLine) maybeInsertComment(rows, rightLine, commentsByLine)
      }
      pendingDels.length = 0
      pendingAdds.length = 0
    }

    for (const line of hunk.lines) {
      if (line.type === 'header') {
        flushPending()
        rows.push({ left: line, right: null, type: 'header' })
      } else if (line.type === 'del') {
        pendingDels.push(line)
      } else if (line.type === 'add') {
        pendingAdds.push(line)
      } else {
        flushPending()
        rows.push({ left: line, right: line, type: 'paired' })
        maybeInsertComment(rows, line, commentsByLine)
      }
    }

    flushPending()
  }

  return rows
}

/**
 * Compute indices of side-by-side rows whose content matches the given query.
 * Only paired/header code lines are matched; comment rows are skipped.
 */
export function computeSbsSearchMatches(
  rows: readonly SideBySideRow[],
  query: string,
): readonly number[] {
  if (!query) return []
  const lowerQuery = query.toLowerCase()
  const matches: number[] = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (row.type === 'comment') continue
    if (row.type === 'header') {
      continue
    }
    const leftMatch =
      row.left &&
      row.left.type !== 'header' &&
      row.left.content.toLowerCase().includes(lowerQuery)
    const rightMatch =
      row.right &&
      row.right.type !== 'header' &&
      row.right.content.toLowerCase().includes(lowerQuery)
    if (leftMatch || rightMatch) {
      matches.push(i)
    }
  }
  return matches
}
