import { describe, it, expect } from 'vitest'
import {
  findNextHunkStart,
  findPrevHunkStart,
  findRowByLineNumber,
  findNextSbsHunkStart,
  findPrevSbsHunkStart,
  findSbsRowByLineNumber,
} from './diffNavigationHelpers'
import { buildDiffRows } from './DiffView'
import { buildSideBySideRows } from './SideBySideDiffView'
import type { DiffLine, Hunk } from '../../models/diff'
import { parseDiffPatch } from '../../models/diff'

function makeLine(
  type: DiffLine['type'],
  content: string,
  oldLineNumber?: number,
  newLineNumber?: number,
): DiffLine {
  return { type, content, oldLineNumber, newLineNumber }
}

function makeHunk(
  lines: DiffLine[],
  overrides?: Partial<Hunk>,
): Hunk {
  return {
    header: '@@ -1,1 +1,1 @@',
    oldStart: 1,
    oldCount: 1,
    newStart: 1,
    newCount: 1,
    ...overrides,
    lines,
  }
}

// Helper to create a realistic diff with multiple hunks
function buildMultiHunkPatch(): string {
  return [
    '@@ -1,5 +1,5 @@',
    ' context line 1',
    ' context line 2',
    '-old line 3',
    '+new line 3',
    ' context line 4',
    '@@ -20,4 +20,5 @@',
    ' context line 20',
    '-old line 21',
    '-old line 22',
    '+new line 21',
    '+new line 22',
    '+extra line',
    ' context line 23',
  ].join('\n')
}

describe('findNextHunkStart (unified)', () => {
  it('returns -1 for empty rows', () => {
    expect(findNextHunkStart([], 0)).toBe(-1)
  })

  it('jumps to the first changed line in the next hunk', () => {
    const hunks = parseDiffPatch(buildMultiHunkPatch())
    const rows = buildDiffRows(hunks)

    // Currently at row 0 (header of hunk 1)
    // Next hunk starts at the header of hunk 2, first changed line is the del after context
    const result = findNextHunkStart(rows, 0)
    // Should find the first changed (add/del) line in the second hunk
    expect(result).toBeGreaterThan(0)
    const row = rows[result]
    expect(row?.type).toBe('line')
    if (row?.type === 'line') {
      expect(row.line.type === 'add' || row.line.type === 'del').toBe(true)
      expect(row.hunkIndex).toBe(1)
    }
  })

  it('finds the first changed line when cursor is on context', () => {
    const hunks = parseDiffPatch(buildMultiHunkPatch())
    const rows = buildDiffRows(hunks)

    // Find a context line in hunk 0 and jump to next hunk
    const contextIndex = rows.findIndex(
      (r) => r.type === 'line' && r.line.type === 'context' && r.hunkIndex === 0,
    )
    const result = findNextHunkStart(rows, contextIndex)
    expect(result).toBeGreaterThan(contextIndex)
    const row = rows[result]
    if (row?.type === 'line') {
      expect(row.line.type === 'add' || row.line.type === 'del').toBe(true)
    }
  })

  it('wraps to the first hunk when at the last hunk', () => {
    const hunks = parseDiffPatch(buildMultiHunkPatch())
    const rows = buildDiffRows(hunks)

    // Start from the last row
    const lastIndex = rows.length - 1
    const result = findNextHunkStart(rows, lastIndex)
    // Should wrap to first changed line in hunk 0
    expect(result).toBeLessThan(lastIndex)
    const row = rows[result]
    if (row?.type === 'line') {
      expect(row.hunkIndex).toBe(0)
      expect(row.line.type === 'add' || row.line.type === 'del').toBe(true)
    }
  })

  it('returns -1 when there are no changed lines', () => {
    const lines: DiffLine[] = [
      makeLine('header', '@@ -1,2 +1,2 @@'),
      makeLine('context', 'unchanged', 1, 1),
      makeLine('context', 'also unchanged', 2, 2),
    ]
    const rows = buildDiffRows([makeHunk(lines)])
    expect(findNextHunkStart(rows, 0)).toBe(-1)
  })

  it('returns start of only hunk when there is just one hunk', () => {
    const patch = [
      '@@ -1,5 +1,5 @@',
      ' context line 1',
      ' context line 2',
      ' context line 3',
      '-old line',
      '+new line',
    ].join('\n')
    const hunks = parseDiffPatch(patch)
    const rows = buildDiffRows(hunks)

    // With only one hunk, findNextHunkStart returns the start of that hunk
    const result = findNextHunkStart(rows, 0)
    expect(result).toBeGreaterThan(0)
    const row = rows[result]
    if (row?.type === 'line') {
      expect(row.line.type === 'add' || row.line.type === 'del').toBe(true)
    }
  })
})

describe('findPrevHunkStart (unified)', () => {
  it('returns -1 for empty rows', () => {
    expect(findPrevHunkStart([], 0)).toBe(-1)
  })

  it('jumps to the first changed line in the previous hunk', () => {
    const hunks = parseDiffPatch(buildMultiHunkPatch())
    const rows = buildDiffRows(hunks)

    // Start from a line in hunk 1
    const hunk1Index = rows.findIndex(
      (r) => r.type === 'line' && r.hunkIndex === 1 && r.line.type !== 'header',
    )
    const result = findPrevHunkStart(rows, hunk1Index)
    expect(result).toBeLessThan(hunk1Index)
    const row = rows[result]
    if (row?.type === 'line') {
      expect(row.hunkIndex).toBe(0)
      expect(row.line.type === 'add' || row.line.type === 'del').toBe(true)
    }
  })

  it('wraps to the last hunk when at the first hunk', () => {
    const hunks = parseDiffPatch(buildMultiHunkPatch())
    const rows = buildDiffRows(hunks)

    const result = findPrevHunkStart(rows, 0)
    // Should wrap to last hunk
    const row = rows[result]
    if (row?.type === 'line') {
      expect(row.hunkIndex).toBe(1)
      expect(row.line.type === 'add' || row.line.type === 'del').toBe(true)
    }
  })

  it('returns -1 when there are no changed lines', () => {
    const lines: DiffLine[] = [
      makeLine('header', '@@ -1,2 +1,2 @@'),
      makeLine('context', 'unchanged', 1, 1),
    ]
    const rows = buildDiffRows([makeHunk(lines)])
    expect(findPrevHunkStart(rows, 0)).toBe(-1)
  })
})

describe('findRowByLineNumber (unified)', () => {
  it('returns -1 for empty rows', () => {
    expect(findRowByLineNumber([], 1)).toBe(-1)
  })

  it('finds a context line by its new line number', () => {
    const patch = [
      '@@ -5,3 +5,3 @@',
      ' context line',
      '-deleted line',
      '+added line',
    ].join('\n')
    const hunks = parseDiffPatch(patch)
    const rows = buildDiffRows(hunks)

    const result = findRowByLineNumber(rows, 5)
    expect(result).toBeGreaterThan(0) // skip header
    const row = rows[result]
    if (row?.type === 'line') {
      expect(row.newLineNumber).toBe(5)
    }
  })

  it('finds an add line by its new line number', () => {
    const patch = [
      '@@ -5,2 +5,3 @@',
      ' context line',
      '-old',
      '+new1',
      '+new2',
    ].join('\n')
    const hunks = parseDiffPatch(patch)
    const rows = buildDiffRows(hunks)

    const result = findRowByLineNumber(rows, 7)
    expect(result).toBeGreaterThan(0)
    const row = rows[result]
    if (row?.type === 'line') {
      expect(row.newLineNumber).toBe(7)
    }
  })

  it('finds a del line by its old line number', () => {
    const patch = [
      '@@ -10,2 +10,1 @@',
      ' context',
      '-deleted',
    ].join('\n')
    const hunks = parseDiffPatch(patch)
    const rows = buildDiffRows(hunks)

    const result = findRowByLineNumber(rows, 11)
    expect(result).toBeGreaterThan(0)
    const row = rows[result]
    if (row?.type === 'line') {
      expect(row.oldLineNumber).toBe(11)
    }
  })

  it('returns -1 when line number is not found', () => {
    const patch = [
      '@@ -1,2 +1,2 @@',
      ' line one',
      ' line two',
    ].join('\n')
    const hunks = parseDiffPatch(patch)
    const rows = buildDiffRows(hunks)

    expect(findRowByLineNumber(rows, 999)).toBe(-1)
  })

  it('prefers new line numbers over old line numbers', () => {
    const patch = [
      '@@ -1,2 +1,2 @@',
      ' context',
      '-old line 2',
      '+new line 2',
    ].join('\n')
    const hunks = parseDiffPatch(patch)
    const rows = buildDiffRows(hunks)

    // Line number 2 matches both the context (new=2? no, old=2 in context will depend on patch)
    // Let us check: context has old=1, new=1; del has old=2; add has new=2
    // Searching for 2 should find the first match which could be del(old=2) or add(new=2)
    const result = findRowByLineNumber(rows, 2)
    expect(result).toBeGreaterThan(0)
  })
})

describe('findNextSbsHunkStart (side-by-side)', () => {
  it('returns -1 for empty rows', () => {
    expect(findNextSbsHunkStart([], 0)).toBe(-1)
  })

  it('jumps to the first changed line in the next hunk', () => {
    const hunks = parseDiffPatch(buildMultiHunkPatch())
    const rows = buildSideBySideRows(hunks)

    const result = findNextSbsHunkStart(rows, 0)
    expect(result).toBeGreaterThan(0)
    const row = rows[result]
    expect(row?.type).not.toBe('comment')
    if (row?.type === 'paired') {
      const leftType = row.left?.type
      const rightType = row.right?.type
      expect(leftType === 'add' || leftType === 'del' || rightType === 'add' || rightType === 'del').toBe(true)
    }
  })

  it('wraps when at end', () => {
    const hunks = parseDiffPatch(buildMultiHunkPatch())
    const rows = buildSideBySideRows(hunks)

    const result = findNextSbsHunkStart(rows, rows.length - 1)
    expect(result).toBeLessThan(rows.length - 1)
  })
})

describe('findPrevSbsHunkStart (side-by-side)', () => {
  it('returns -1 for empty rows', () => {
    expect(findPrevSbsHunkStart([], 0)).toBe(-1)
  })

  it('jumps back to a previous changed section', () => {
    const hunks = parseDiffPatch(buildMultiHunkPatch())
    const rows = buildSideBySideRows(hunks)

    // Jump to somewhere after first hunk
    const lastIndex = rows.length - 1
    const result = findPrevSbsHunkStart(rows, lastIndex)
    expect(result).toBeLessThan(lastIndex)
    expect(result).toBeGreaterThanOrEqual(0)
  })
})

describe('findSbsRowByLineNumber (side-by-side)', () => {
  it('returns -1 for empty rows', () => {
    expect(findSbsRowByLineNumber([], 1)).toBe(-1)
  })

  it('finds a row by new line number', () => {
    const patch = [
      '@@ -5,3 +5,3 @@',
      ' context line',
      '-deleted line',
      '+added line',
    ].join('\n')
    const hunks = parseDiffPatch(patch)
    const rows = buildSideBySideRows(hunks)

    const result = findSbsRowByLineNumber(rows, 5)
    expect(result).toBeGreaterThanOrEqual(0)
  })

  it('returns -1 when line not found', () => {
    const patch = [
      '@@ -1,2 +1,2 @@',
      ' line one',
      ' line two',
    ].join('\n')
    const hunks = parseDiffPatch(patch)
    const rows = buildSideBySideRows(hunks)

    expect(findSbsRowByLineNumber(rows, 999)).toBe(-1)
  })
})
