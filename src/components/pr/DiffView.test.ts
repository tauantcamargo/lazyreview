import { describe, it, expect } from 'vitest'
import { buildDiffRows, getLanguageFromFilename } from './DiffView'
import type { Hunk, DiffLine } from '../../models/diff'
import type { DiffCommentThread } from './DiffComment'

function makeLine(type: DiffLine['type'], content: string): DiffLine {
  return {
    type,
    content,
    ...(type === 'context' ? { oldLineNumber: 1, newLineNumber: 1 } : {}),
    ...(type === 'add' ? { newLineNumber: 1 } : {}),
    ...(type === 'del' ? { oldLineNumber: 1 } : {}),
  } as DiffLine
}

function makeHunk(lines: DiffLine[]): Hunk {
  return {
    oldStart: 1,
    oldCount: 1,
    newStart: 1,
    newCount: 1,
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

describe('buildDiffRows', () => {
  it('returns empty array for empty hunks', () => {
    expect(buildDiffRows([])).toEqual([])
  })

  it('creates line rows from hunks', () => {
    const lines: DiffLine[] = [
      makeLine('header', '@@ -1,2 +1,2 @@'),
      makeLine('context', 'unchanged'),
      makeLine('del', 'removed'),
      makeLine('add', 'added'),
    ]
    const hunks = [makeHunk(lines)]
    const rows = buildDiffRows(hunks)

    expect(rows).toHaveLength(4)
    expect(rows[0]!.type).toBe('line')
    expect(rows[1]!.type).toBe('line')
    expect(rows[2]!.type).toBe('line')
    expect(rows[3]!.type).toBe('line')
  })

  it('assigns correct line numbers', () => {
    const lines: DiffLine[] = [
      makeLine('header', '@@ -1,3 +1,3 @@'),
      makeLine('context', 'a'),
      makeLine('del', 'b'),
      makeLine('add', 'c'),
    ]
    const hunks = [makeHunk(lines)]
    const rows = buildDiffRows(hunks)

    // header gets lineNumber 1 (does not increment)
    const firstRow = rows[0]!
    if (firstRow.type === 'line') {
      expect(firstRow.lineNumber).toBe(1)
    }
    // context gets lineNumber 1, increments to 2
    const secondRow = rows[1]!
    if (secondRow.type === 'line') {
      expect(secondRow.lineNumber).toBe(1)
    }
    // del gets lineNumber 2, increments to 3
    const thirdRow = rows[2]!
    if (thirdRow.type === 'line') {
      expect(thirdRow.lineNumber).toBe(2)
    }
  })

  it('inserts comment rows after matching lines', () => {
    const lines: DiffLine[] = [
      makeLine('header', '@@ -1,2 +1,2 @@'),
      makeLine('context', 'line one'),
      makeLine('add', 'line two'),
    ]
    const hunks = [makeHunk(lines)]
    const commentsByLine = new Map<number, DiffCommentThread>()
    commentsByLine.set(2, mockThread)

    const rows = buildDiffRows(hunks, commentsByLine)

    // header (lineNum 1, no increment) + context (lineNum 1) + add (lineNum 2) + comment after lineNum 2
    expect(rows).toHaveLength(4)
    expect(rows[2]!.type).toBe('line')
    expect(rows[3]!.type).toBe('comment')
    if (rows[3]!.type === 'comment') {
      expect(rows[3]!.thread).toBe(mockThread)
    }
  })

  it('does not insert comments after header lines', () => {
    const lines: DiffLine[] = [
      makeLine('header', '@@ -1,1 +1,1 @@'),
      makeLine('context', 'only line'),
    ]
    const hunks = [makeHunk(lines)]
    const commentsByLine = new Map<number, DiffCommentThread>()
    commentsByLine.set(1, mockThread)

    const rows = buildDiffRows(hunks, commentsByLine)

    // header (lineNum 1, not checked for comments) + context (lineNum 1) + comment
    expect(rows).toHaveLength(3)
    expect(rows[0]!.type).toBe('line')
    expect(rows[1]!.type).toBe('line')
    expect(rows[2]!.type).toBe('comment')
  })

  it('returns only line rows when no commentsByLine provided', () => {
    const lines: DiffLine[] = [
      makeLine('header', '@@'),
      makeLine('context', 'line'),
    ]
    const hunks = [makeHunk(lines)]
    const rows = buildDiffRows(hunks)

    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.type === 'line')).toBe(true)
  })

  it('handles multiple hunks', () => {
    const hunk1 = makeHunk([makeLine('header', '@@'), makeLine('context', 'a')])
    const hunk2 = makeHunk([makeLine('header', '@@'), makeLine('add', 'b')])
    const rows = buildDiffRows([hunk1, hunk2])

    expect(rows).toHaveLength(4)
    if (rows[0]!.type === 'line') expect(rows[0]!.hunkIndex).toBe(0)
    if (rows[2]!.type === 'line') expect(rows[2]!.hunkIndex).toBe(1)
  })
})
