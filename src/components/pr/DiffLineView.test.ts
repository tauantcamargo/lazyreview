import { describe, it, expect } from 'vitest'
import { BLAME_GUTTER_WIDTH, getBlameForRow } from './DiffLineView'
import type { BlameInfo } from '../../models/blame'
import type { FoldableRow } from '../../utils/hunk-folding'

describe('BLAME_GUTTER_WIDTH', () => {
  it('is 14 characters wide', () => {
    expect(BLAME_GUTTER_WIDTH).toBe(14)
  })
})

describe('getBlameForRow', () => {
  const blameData = new Map<number, BlameInfo>([
    [5, { author: 'alice', date: '2026-01-15', commitHash: 'abc123', summary: 'init' }],
    [10, { author: 'bob', date: '2026-02-01', commitHash: 'def456', summary: 'fix' }],
  ])

  it('returns blame info for context lines using newLineNumber', () => {
    const row: FoldableRow = {
      type: 'line',
      line: { type: 'context', content: 'code', oldLineNumber: 4, newLineNumber: 5 },
      lineNumber: 5,
      oldLineNumber: 4,
      newLineNumber: 5,
      hunkIndex: 0,
    }
    expect(getBlameForRow(row, blameData)).toEqual(blameData.get(5))
  })

  it('returns blame info for del lines using oldLineNumber', () => {
    const row: FoldableRow = {
      type: 'line',
      line: { type: 'del', content: 'removed', oldLineNumber: 10 },
      lineNumber: 10,
      oldLineNumber: 10,
      newLineNumber: undefined,
      hunkIndex: 0,
    }
    expect(getBlameForRow(row, blameData)).toEqual(blameData.get(10))
  })

  it('returns undefined for folded rows', () => {
    const row: FoldableRow = {
      type: 'folded',
      hunkIndex: 0,
      foldedLineCount: 5,
    }
    expect(getBlameForRow(row, blameData)).toBeUndefined()
  })

  it('returns undefined for comment rows', () => {
    const row: FoldableRow = {
      type: 'comment',
      thread: { comments: [] },
    } as unknown as FoldableRow
    expect(getBlameForRow(row, blameData)).toBeUndefined()
  })

  it('returns undefined when line number has no blame data', () => {
    const row: FoldableRow = {
      type: 'line',
      line: { type: 'add', content: 'new', newLineNumber: 99 },
      lineNumber: 99,
      oldLineNumber: undefined,
      newLineNumber: 99,
      hunkIndex: 0,
    }
    expect(getBlameForRow(row, blameData)).toBeUndefined()
  })
})
