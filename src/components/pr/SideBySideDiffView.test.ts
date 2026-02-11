import { describe, it, expect } from 'vitest'
import {
  buildSideBySideRows,
  SIDE_BY_SIDE_MIN_WIDTH,
  type SideBySideRow,
} from './SideBySideDiffView'
import type { Hunk, DiffLine } from '../../models/diff'

function makeHunk(lines: readonly DiffLine[]): Hunk {
  return {
    header: '@@ -1,3 +1,3 @@',
    oldStart: 1,
    oldCount: 3,
    newStart: 1,
    newCount: 3,
    lines,
  }
}

describe('buildSideBySideRows', () => {
  it('returns empty array for no hunks', () => {
    expect(buildSideBySideRows([])).toEqual([])
  })

  it('places header lines on the left only', () => {
    const hunk = makeHunk([
      { type: 'header', content: '@@ -1,3 +1,3 @@' },
    ])
    const rows = buildSideBySideRows([hunk])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.type).toBe('header')
    expect(rows[0]!.left?.type).toBe('header')
    expect(rows[0]!.right).toBeNull()
  })

  it('places context lines on both sides', () => {
    const hunk = makeHunk([
      { type: 'context', content: 'same', oldLineNumber: 1, newLineNumber: 1 },
    ])
    const rows = buildSideBySideRows([hunk])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.left?.content).toBe('same')
    expect(rows[0]!.right?.content).toBe('same')
  })

  it('pairs deletions with additions', () => {
    const hunk = makeHunk([
      { type: 'del', content: 'old line', oldLineNumber: 1 },
      { type: 'add', content: 'new line', newLineNumber: 1 },
    ])
    const rows = buildSideBySideRows([hunk])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.left?.content).toBe('old line')
    expect(rows[0]!.right?.content).toBe('new line')
  })

  it('handles unmatched deletions (more dels than adds)', () => {
    const hunk = makeHunk([
      { type: 'del', content: 'deleted 1', oldLineNumber: 1 },
      { type: 'del', content: 'deleted 2', oldLineNumber: 2 },
      { type: 'add', content: 'added 1', newLineNumber: 1 },
    ])
    const rows = buildSideBySideRows([hunk])
    expect(rows).toHaveLength(2)
    expect(rows[0]!.left?.content).toBe('deleted 1')
    expect(rows[0]!.right?.content).toBe('added 1')
    expect(rows[1]!.left?.content).toBe('deleted 2')
    expect(rows[1]!.right).toBeNull()
  })

  it('handles unmatched additions (more adds than dels)', () => {
    const hunk = makeHunk([
      { type: 'del', content: 'deleted 1', oldLineNumber: 1 },
      { type: 'add', content: 'added 1', newLineNumber: 1 },
      { type: 'add', content: 'added 2', newLineNumber: 2 },
    ])
    const rows = buildSideBySideRows([hunk])
    expect(rows).toHaveLength(2)
    expect(rows[0]!.left?.content).toBe('deleted 1')
    expect(rows[0]!.right?.content).toBe('added 1')
    expect(rows[1]!.left).toBeNull()
    expect(rows[1]!.right?.content).toBe('added 2')
  })

  it('flushes pending dels/adds before context lines', () => {
    const hunk = makeHunk([
      { type: 'del', content: 'old', oldLineNumber: 1 },
      { type: 'context', content: 'same', oldLineNumber: 2, newLineNumber: 2 },
    ])
    const rows = buildSideBySideRows([hunk])
    expect(rows).toHaveLength(2)
    expect(rows[0]!.left?.content).toBe('old')
    expect(rows[0]!.right).toBeNull()
    expect(rows[1]!.left?.content).toBe('same')
    expect(rows[1]!.right?.content).toBe('same')
  })

  it('handles multiple hunks', () => {
    const hunk1 = makeHunk([
      { type: 'header', content: '@@ -1,1 +1,1 @@' },
      { type: 'del', content: 'a', oldLineNumber: 1 },
      { type: 'add', content: 'b', newLineNumber: 1 },
    ])
    const hunk2 = makeHunk([
      { type: 'header', content: '@@ -10,1 +10,1 @@' },
      { type: 'context', content: 'x', oldLineNumber: 10, newLineNumber: 10 },
    ])
    const rows = buildSideBySideRows([hunk1, hunk2])
    expect(rows).toHaveLength(4)
    expect(rows[0]!.type).toBe('header')
    expect(rows[1]!.left?.content).toBe('a')
    expect(rows[1]!.right?.content).toBe('b')
    expect(rows[2]!.type).toBe('header')
    expect(rows[3]!.left?.content).toBe('x')
  })
})

describe('SIDE_BY_SIDE_MIN_WIDTH', () => {
  it('is 100 columns', () => {
    expect(SIDE_BY_SIDE_MIN_WIDTH).toBe(100)
  })
})
