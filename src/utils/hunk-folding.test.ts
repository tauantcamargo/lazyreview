import { describe, it, expect } from 'vitest'
import {
  applyHunkFolding,
  toggleHunkFold,
  getHunkIndexForRow,
  type FoldedHunkPlaceholder,
} from './hunk-folding'
import type { DiffDisplayRow } from '../components/pr/DiffView'
import type { DiffLine } from '../models/diff'

function makeLine(
  type: DiffLine['type'],
  content: string,
  oldLineNumber?: number,
  newLineNumber?: number,
): DiffLine {
  return { type, content, oldLineNumber, newLineNumber }
}

function makeLineRow(
  line: DiffLine,
  hunkIndex: number,
): DiffDisplayRow {
  return {
    type: 'line',
    line,
    lineNumber: line.newLineNumber ?? line.oldLineNumber,
    oldLineNumber: line.oldLineNumber,
    newLineNumber: line.newLineNumber,
    hunkIndex,
  }
}

function makeCommentRow(): DiffDisplayRow {
  return {
    type: 'comment',
    thread: {
      comments: [{
        id: 1,
        body: 'test',
        user: { login: 'user', avatar_url: '' },
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        html_url: '',
      }],
    },
  } as DiffDisplayRow
}

describe('applyHunkFolding', () => {
  it('returns rows unchanged when no hunks are folded', () => {
    const rows: DiffDisplayRow[] = [
      makeLineRow(makeLine('header', '@@ -1,2 +1,2 @@'), 0),
      makeLineRow(makeLine('context', 'a', 1, 1), 0),
      makeLineRow(makeLine('add', 'b', undefined, 2), 0),
    ]
    const result = applyHunkFolding(rows, new Set())
    expect(result).toEqual(rows)
  })

  it('replaces folded hunk rows with a placeholder', () => {
    const rows: DiffDisplayRow[] = [
      makeLineRow(makeLine('header', '@@ -1,3 +1,3 @@'), 0),
      makeLineRow(makeLine('context', 'a', 1, 1), 0),
      makeLineRow(makeLine('del', 'b', 2), 0),
      makeLineRow(makeLine('add', 'c', undefined, 2), 0),
    ]
    const result = applyHunkFolding(rows, new Set([0]))

    expect(result).toHaveLength(1)
    expect(result[0]!.type).toBe('folded')
    const folded = result[0] as FoldedHunkPlaceholder
    expect(folded.hunkIndex).toBe(0)
    expect(folded.foldedLineCount).toBe(4)
  })

  it('preserves rows from unfolded hunks', () => {
    const rows: DiffDisplayRow[] = [
      makeLineRow(makeLine('header', '@@'), 0),
      makeLineRow(makeLine('context', 'a', 1, 1), 0),
      makeLineRow(makeLine('header', '@@'), 1),
      makeLineRow(makeLine('add', 'b', undefined, 10), 1),
    ]
    const result = applyHunkFolding(rows, new Set([0]))

    // Hunk 0 is folded -> 1 placeholder; hunk 1 is expanded -> 2 rows
    expect(result).toHaveLength(3)
    expect(result[0]!.type).toBe('folded')
    expect(result[1]!.type).toBe('line')
    expect(result[2]!.type).toBe('line')
  })

  it('folds multiple hunks independently', () => {
    const rows: DiffDisplayRow[] = [
      makeLineRow(makeLine('header', '@@'), 0),
      makeLineRow(makeLine('context', 'a', 1, 1), 0),
      makeLineRow(makeLine('header', '@@'), 1),
      makeLineRow(makeLine('context', 'b', 10, 10), 1),
      makeLineRow(makeLine('header', '@@'), 2),
      makeLineRow(makeLine('add', 'c', undefined, 20), 2),
    ]
    const result = applyHunkFolding(rows, new Set([0, 2]))

    // Hunk 0 folded (1 placeholder), hunk 1 expanded (2 rows), hunk 2 folded (1 placeholder)
    expect(result).toHaveLength(4)
    expect(result[0]!.type).toBe('folded')
    expect((result[0] as FoldedHunkPlaceholder).hunkIndex).toBe(0)
    expect(result[1]!.type).toBe('line')
    expect(result[2]!.type).toBe('line')
    expect(result[3]!.type).toBe('folded')
    expect((result[3] as FoldedHunkPlaceholder).hunkIndex).toBe(2)
  })

  it('includes comment rows with their associated hunk when folded', () => {
    const rows: DiffDisplayRow[] = [
      makeLineRow(makeLine('header', '@@'), 0),
      makeLineRow(makeLine('add', 'code', undefined, 1), 0),
      makeCommentRow(),
    ]
    const result = applyHunkFolding(rows, new Set([0]))

    // The comment row is treated as belonging to the previous hunk and is folded away
    expect(result).toHaveLength(1)
    expect(result[0]!.type).toBe('folded')
    // foldedLineCount includes the 2 line rows but not the comment
    expect((result[0] as FoldedHunkPlaceholder).foldedLineCount).toBe(2)
  })

  it('handles empty rows', () => {
    const result = applyHunkFolding([], new Set([0]))
    expect(result).toEqual([])
  })
})

describe('toggleHunkFold', () => {
  it('adds a hunk index to the set', () => {
    const result = toggleHunkFold(new Set(), 0)
    expect(result.has(0)).toBe(true)
  })

  it('removes a hunk index from the set', () => {
    const result = toggleHunkFold(new Set([0, 1]), 0)
    expect(result.has(0)).toBe(false)
    expect(result.has(1)).toBe(true)
  })

  it('returns a new Set (immutable)', () => {
    const original = new Set([1])
    const result = toggleHunkFold(original, 2)
    expect(result).not.toBe(original)
    expect(original.has(2)).toBe(false)
  })
})

describe('getHunkIndexForRow', () => {
  it('returns hunk index for a line row', () => {
    const rows: DiffDisplayRow[] = [
      makeLineRow(makeLine('header', '@@'), 0),
      makeLineRow(makeLine('context', 'a', 1, 1), 0),
      makeLineRow(makeLine('header', '@@'), 1),
      makeLineRow(makeLine('add', 'b', undefined, 10), 1),
    ]
    expect(getHunkIndexForRow(rows, 0)).toBe(0)
    expect(getHunkIndexForRow(rows, 1)).toBe(0)
    expect(getHunkIndexForRow(rows, 2)).toBe(1)
    expect(getHunkIndexForRow(rows, 3)).toBe(1)
  })

  it('returns -1 for comment rows', () => {
    const rows: DiffDisplayRow[] = [
      makeLineRow(makeLine('add', 'code', undefined, 1), 0),
      makeCommentRow(),
    ]
    expect(getHunkIndexForRow(rows, 1)).toBe(-1)
  })

  it('returns -1 for out-of-bounds index', () => {
    const rows: DiffDisplayRow[] = [
      makeLineRow(makeLine('context', 'a', 1, 1), 0),
    ]
    expect(getHunkIndexForRow(rows, 5)).toBe(-1)
  })

  it('returns hunkIndex from folded placeholder rows', () => {
    const foldedRows = applyHunkFolding(
      [
        makeLineRow(makeLine('header', '@@'), 0),
        makeLineRow(makeLine('context', 'a', 1, 1), 0),
        makeLineRow(makeLine('header', '@@'), 1),
        makeLineRow(makeLine('add', 'b', undefined, 10), 1),
      ],
      new Set([0]),
    )
    // First row is folded placeholder for hunk 0
    expect(getHunkIndexForRow(foldedRows, 0)).toBe(0)
    // Rows 1 and 2 are from hunk 1
    expect(getHunkIndexForRow(foldedRows, 1)).toBe(1)
  })
})
