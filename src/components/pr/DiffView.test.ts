import { describe, it, expect } from 'vitest'
import { buildDiffRows, getLanguageFromFilename, getDiffLineNumber, computeDiffSearchMatches } from './DiffView'
import type { Hunk, DiffLine } from '../../models/diff'
import { parseDiffPatch } from '../../models/diff'
import type { DiffCommentThread } from './DiffComment'

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

const mockThread: DiffCommentThread = {
  comments: [
    {
      id: 100,
      body: 'test comment',
      user: { login: 'testuser', avatar_url: 'https://example.com/avatar.png' },
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      html_url: 'https://github.com/test',
    } as DiffCommentThread['comments'][0],
  ],
  threadId: 'thread-1',
  isResolved: false,
}

describe('getLanguageFromFilename', () => {
  it('returns typescript for .ts files', () => {
    expect(getLanguageFromFilename('src/index.ts')).toBe('typescript')
  })

  it('returns typescript for .tsx files', () => {
    expect(getLanguageFromFilename('Component.tsx')).toBe('typescript')
  })

  it('returns javascript for .js files', () => {
    expect(getLanguageFromFilename('utils.js')).toBe('javascript')
  })

  it('returns python for .py files', () => {
    expect(getLanguageFromFilename('script.py')).toBe('python')
  })

  it('returns undefined for unknown extensions', () => {
    expect(getLanguageFromFilename('file.xyz')).toBeUndefined()
  })

  it('returns undefined for files with no extension', () => {
    expect(getLanguageFromFilename('Makefile')).toBeUndefined()
  })

  it('returns yaml for .yml files', () => {
    expect(getLanguageFromFilename('config.yml')).toBe('yaml')
  })
})

describe('getDiffLineNumber', () => {
  it('returns newLineNumber for add lines', () => {
    const line = makeLine('add', 'added', undefined, 42)
    expect(getDiffLineNumber(line)).toBe(42)
  })

  it('returns oldLineNumber for del lines', () => {
    const line = makeLine('del', 'deleted', 10, undefined)
    expect(getDiffLineNumber(line)).toBe(10)
  })

  it('returns newLineNumber for context lines', () => {
    const line = makeLine('context', 'unchanged', 5, 8)
    expect(getDiffLineNumber(line)).toBe(8)
  })

  it('returns undefined for header lines', () => {
    const line = makeLine('header', '@@ -1,3 +1,3 @@')
    expect(getDiffLineNumber(line)).toBeUndefined()
  })

  it('returns undefined when line numbers are missing', () => {
    const line = makeLine('add', 'content')
    expect(getDiffLineNumber(line)).toBeUndefined()
  })
})

describe('buildDiffRows', () => {
  it('returns empty array for empty hunks', () => {
    expect(buildDiffRows([])).toEqual([])
  })

  it('creates line rows from hunks', () => {
    const lines: DiffLine[] = [
      makeLine('header', '@@ -1,2 +1,2 @@'),
      makeLine('context', 'unchanged', 1, 1),
      makeLine('del', 'removed', 2),
      makeLine('add', 'added', undefined, 2),
    ]
    const hunks = [makeHunk(lines)]
    const rows = buildDiffRows(hunks)

    expect(rows).toHaveLength(4)
    expect(rows[0]!.type).toBe('line')
    expect(rows[1]!.type).toBe('line')
    expect(rows[2]!.type).toBe('line')
    expect(rows[3]!.type).toBe('line')
  })

  it('uses actual file line numbers from DiffLine, not sequential counter', () => {
    // Simulate a hunk starting at old line 10, new line 15
    const lines: DiffLine[] = [
      makeLine('header', '@@ -10,3 +15,3 @@'),
      makeLine('context', 'a', 10, 15),
      makeLine('del', 'b', 11),
      makeLine('add', 'c', undefined, 16),
    ]
    const hunks = [makeHunk(lines, { oldStart: 10, newStart: 15 })]
    const rows = buildDiffRows(hunks)

    // header has no line number
    const headerRow = rows[0]!
    if (headerRow.type === 'line') {
      expect(headerRow.lineNumber).toBeUndefined()
    }

    // context line: newLineNumber = 15
    const contextRow = rows[1]!
    if (contextRow.type === 'line') {
      expect(contextRow.lineNumber).toBe(15)
      expect(contextRow.oldLineNumber).toBe(10)
      expect(contextRow.newLineNumber).toBe(15)
    }

    // del line: oldLineNumber = 11
    const delRow = rows[2]!
    if (delRow.type === 'line') {
      expect(delRow.lineNumber).toBe(11)
      expect(delRow.oldLineNumber).toBe(11)
      expect(delRow.newLineNumber).toBeUndefined()
    }

    // add line: newLineNumber = 16
    const addRow = rows[3]!
    if (addRow.type === 'line') {
      expect(addRow.lineNumber).toBe(16)
      expect(addRow.oldLineNumber).toBeUndefined()
      expect(addRow.newLineNumber).toBe(16)
    }
  })

  it('maps comments using composite side:line key', () => {
    const lines: DiffLine[] = [
      makeLine('header', '@@ -5,2 +5,3 @@'),
      makeLine('context', 'unchanged', 5, 5),
      makeLine('del', 'old code', 6),
      makeLine('add', 'new code', undefined, 6),
      makeLine('add', 'extra line', undefined, 7),
    ]
    const hunks = [makeHunk(lines, { oldStart: 5, newStart: 5 })]

    // Comment on RIGHT side, line 7 (the "extra line" addition)
    const commentsByLine = new Map<string, DiffCommentThread>()
    commentsByLine.set('RIGHT:7', mockThread)

    const rows = buildDiffRows(hunks, commentsByLine)

    // header + context + del + add(6) + add(7) + comment
    expect(rows).toHaveLength(6)
    expect(rows[4]!.type).toBe('line')
    expect(rows[5]!.type).toBe('comment')
    if (rows[5]!.type === 'comment') {
      expect(rows[5]!.thread).toBe(mockThread)
    }
  })

  it('maps LEFT side comments to deletion lines', () => {
    const lines: DiffLine[] = [
      makeLine('header', '@@ -10,2 +10,1 @@'),
      makeLine('context', 'keep', 10, 10),
      makeLine('del', 'removed', 11),
    ]
    const hunks = [makeHunk(lines, { oldStart: 10, newStart: 10 })]

    const leftThread: DiffCommentThread = {
      comments: [
        {
          id: 200,
          body: 'left side comment',
          user: { login: 'reviewer', avatar_url: 'https://example.com/a.png' },
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          html_url: 'https://github.com/test',
        } as DiffCommentThread['comments'][0],
      ],
      threadId: 'thread-left',
      isResolved: false,
    }

    const commentsByLine = new Map<string, DiffCommentThread>()
    commentsByLine.set('LEFT:11', leftThread)

    const rows = buildDiffRows(hunks, commentsByLine)

    // header + context + del + comment
    expect(rows).toHaveLength(4)
    expect(rows[2]!.type).toBe('line')
    expect(rows[3]!.type).toBe('comment')
    if (rows[3]!.type === 'comment') {
      expect(rows[3]!.thread).toBe(leftThread)
    }
  })

  it('does not insert comments after header lines', () => {
    const lines: DiffLine[] = [
      makeLine('header', '@@ -1,1 +1,1 @@'),
      makeLine('context', 'only line', 1, 1),
    ]
    const hunks = [makeHunk(lines)]
    const commentsByLine = new Map<string, DiffCommentThread>()
    commentsByLine.set('RIGHT:1', mockThread)

    const rows = buildDiffRows(hunks, commentsByLine)

    // header + context + comment (comment matches context line at newLine=1)
    expect(rows).toHaveLength(3)
    expect(rows[0]!.type).toBe('line')
    expect(rows[1]!.type).toBe('line')
    expect(rows[2]!.type).toBe('comment')
  })

  it('returns only line rows when no commentsByLine provided', () => {
    const lines: DiffLine[] = [
      makeLine('header', '@@'),
      makeLine('context', 'line', 1, 1),
    ]
    const hunks = [makeHunk(lines)]
    const rows = buildDiffRows(hunks)

    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.type === 'line')).toBe(true)
  })

  it('handles multiple hunks with correct line numbers', () => {
    const hunk1Lines: DiffLine[] = [
      makeLine('header', '@@ -1,2 +1,2 @@'),
      makeLine('context', 'a', 1, 1),
      makeLine('context', 'b', 2, 2),
    ]
    const hunk2Lines: DiffLine[] = [
      makeLine('header', '@@ -10,2 +10,2 @@'),
      makeLine('del', 'old', 10),
      makeLine('add', 'new', undefined, 10),
    ]
    const hunk1 = makeHunk(hunk1Lines, { oldStart: 1, newStart: 1 })
    const hunk2 = makeHunk(hunk2Lines, { oldStart: 10, newStart: 10 })
    const rows = buildDiffRows([hunk1, hunk2])

    expect(rows).toHaveLength(6)

    // First hunk
    if (rows[0]!.type === 'line') expect(rows[0]!.hunkIndex).toBe(0)
    if (rows[1]!.type === 'line') expect(rows[1]!.lineNumber).toBe(1)
    if (rows[2]!.type === 'line') expect(rows[2]!.lineNumber).toBe(2)

    // Second hunk
    if (rows[3]!.type === 'line') expect(rows[3]!.hunkIndex).toBe(1)
    if (rows[4]!.type === 'line') expect(rows[4]!.lineNumber).toBe(10)
    if (rows[5]!.type === 'line') expect(rows[5]!.lineNumber).toBe(10)
  })

  it('integrates with parseDiffPatch for real diff output', () => {
    const patch = [
      '@@ -5,3 +5,4 @@',
      ' context line',
      '-deleted line',
      '+added line',
      '+new line',
      ' trailing',
    ].join('\n')

    const hunks = parseDiffPatch(patch)
    const rows = buildDiffRows(hunks)

    // header + context(5) + del(6) + add(6) + add(7) + context(8)
    expect(rows).toHaveLength(6)

    // Context at old:5, new:5 -> lineNumber = 5 (newLineNumber)
    if (rows[1]!.type === 'line') {
      expect(rows[1]!.lineNumber).toBe(5)
      expect(rows[1]!.oldLineNumber).toBe(5)
      expect(rows[1]!.newLineNumber).toBe(5)
    }

    // Del at old:6 -> lineNumber = 6
    if (rows[2]!.type === 'line') {
      expect(rows[2]!.lineNumber).toBe(6)
      expect(rows[2]!.oldLineNumber).toBe(6)
      expect(rows[2]!.newLineNumber).toBeUndefined()
    }

    // Add at new:6 -> lineNumber = 6
    if (rows[3]!.type === 'line') {
      expect(rows[3]!.lineNumber).toBe(6)
      expect(rows[3]!.newLineNumber).toBe(6)
    }

    // Add at new:7 -> lineNumber = 7
    if (rows[4]!.type === 'line') {
      expect(rows[4]!.lineNumber).toBe(7)
      expect(rows[4]!.newLineNumber).toBe(7)
    }

    // Trailing context at old:7, new:8 -> lineNumber = 8
    if (rows[5]!.type === 'line') {
      expect(rows[5]!.lineNumber).toBe(8)
      expect(rows[5]!.oldLineNumber).toBe(7)
      expect(rows[5]!.newLineNumber).toBe(8)
    }
  })

  it('matches comments correctly with parseDiffPatch output', () => {
    const patch = [
      '@@ -10,3 +10,3 @@',
      ' unchanged',
      '-old code',
      '+new code',
      ' end',
    ].join('\n')

    const hunks = parseDiffPatch(patch)

    // Comment on the "new code" addition at new line 11
    const commentsByLine = new Map<string, DiffCommentThread>()
    commentsByLine.set('RIGHT:11', mockThread)

    const rows = buildDiffRows(hunks, commentsByLine)

    // header + context(10) + del(11) + add(11) + comment + context(12)
    expect(rows).toHaveLength(6)
    expect(rows[3]!.type === 'line').toBe(true)
    expect(rows[4]!.type).toBe('comment')
  })
})

describe('computeDiffSearchMatches', () => {
  it('returns empty array for empty query', () => {
    const rows = buildDiffRows([makeHunk([makeLine('context', 'hello', 1, 1)])])
    expect(computeDiffSearchMatches(rows, '')).toEqual([])
  })

  it('returns empty array when no rows match', () => {
    const rows = buildDiffRows([makeHunk([makeLine('context', 'hello world', 1, 1)])])
    expect(computeDiffSearchMatches(rows, 'xyz')).toEqual([])
  })

  it('matches case-insensitively', () => {
    const rows = buildDiffRows([makeHunk([
      makeLine('header', '@@ -1,1 +1,1 @@'),
      makeLine('context', 'Hello World', 1, 1),
    ])])
    const matches = computeDiffSearchMatches(rows, 'hello')
    expect(matches).toEqual([1])
  })

  it('skips header rows', () => {
    const rows = buildDiffRows([makeHunk([
      makeLine('header', '@@ contains search term @@'),
      makeLine('context', 'no match here', 1, 1),
    ])])
    const matches = computeDiffSearchMatches(rows, 'contains')
    expect(matches).toEqual([])
  })

  it('skips comment rows', () => {
    const lines: DiffLine[] = [
      makeLine('header', '@@'),
      makeLine('context', 'code line', 1, 1),
    ]
    const commentsByLine = new Map<string, DiffCommentThread>()
    commentsByLine.set('RIGHT:1', mockThread)
    const rows = buildDiffRows([makeHunk(lines)], commentsByLine)
    // rows: header, context, comment
    const matches = computeDiffSearchMatches(rows, 'test comment')
    expect(matches).toEqual([])
  })

  it('matches add, del, and context lines', () => {
    const rows = buildDiffRows([makeHunk([
      makeLine('header', '@@'),
      makeLine('context', 'keep this function', 1, 1),
      makeLine('del', 'remove old function', 2),
      makeLine('add', 'add new function', undefined, 2),
    ])])
    const matches = computeDiffSearchMatches(rows, 'function')
    // indices 1, 2, 3 (skip header at 0)
    expect(matches).toEqual([1, 2, 3])
  })

  it('returns indices of only matching rows', () => {
    const rows = buildDiffRows([makeHunk([
      makeLine('header', '@@'),
      makeLine('context', 'alpha', 1, 1),
      makeLine('context', 'beta', 2, 2),
      makeLine('context', 'alpha again', 3, 3),
    ])])
    const matches = computeDiffSearchMatches(rows, 'alpha')
    expect(matches).toEqual([1, 3])
  })
})
