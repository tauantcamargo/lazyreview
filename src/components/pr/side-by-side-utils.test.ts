import { describe, it, expect } from 'vitest'
import {
  buildSideBySideRows,
  computeSbsSearchMatches,
} from './side-by-side-utils'
import type { Hunk, DiffLine } from '../../models/diff'
import type { DiffCommentThread } from './DiffComment'

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

  it('inserts comment rows after matching lines', () => {
    const hunk = makeHunk([
      { type: 'add', content: 'new line', newLineNumber: 5 },
    ])
    const thread: DiffCommentThread = {
      comments: [{
        id: 1,
        body: 'looks good',
        user: { login: 'alice', avatar_url: '', id: 1 },
        path: 'test.ts',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        html_url: 'https://example.com',
      } as DiffCommentThread['comments'][number]],
    }
    const commentsByLine = new Map<string, DiffCommentThread>([
      ['RIGHT:5', thread],
    ])
    const rows = buildSideBySideRows([hunk], commentsByLine)
    expect(rows).toHaveLength(2)
    expect(rows[0]!.type).toBe('paired')
    expect(rows[1]!.type).toBe('comment')
    if (rows[1]!.type === 'comment') {
      expect(rows[1]!.thread.comments).toHaveLength(1)
    }
  })

  it('inserts comment for deletion lines on LEFT side', () => {
    const hunk = makeHunk([
      { type: 'del', content: 'old line', oldLineNumber: 3 },
    ])
    const thread: DiffCommentThread = {
      comments: [{
        id: 2,
        body: 'why remove this?',
        user: { login: 'bob', avatar_url: '', id: 2 },
        path: 'test.ts',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        html_url: 'https://example.com',
      } as DiffCommentThread['comments'][number]],
    }
    const commentsByLine = new Map<string, DiffCommentThread>([
      ['LEFT:3', thread],
    ])
    const rows = buildSideBySideRows([hunk], commentsByLine)
    expect(rows).toHaveLength(2)
    expect(rows[1]!.type).toBe('comment')
  })

  it('returns no comments when commentsByLine is not provided', () => {
    const hunk = makeHunk([
      { type: 'add', content: 'new line', newLineNumber: 1 },
    ])
    const rows = buildSideBySideRows([hunk])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.type).toBe('paired')
  })
})

describe('computeSbsSearchMatches', () => {
  it('returns empty array for empty query', () => {
    const rows = buildSideBySideRows([makeHunk([
      { type: 'context', content: 'hello', oldLineNumber: 1, newLineNumber: 1 },
    ])])
    expect(computeSbsSearchMatches(rows, '')).toEqual([])
  })

  it('returns empty array when no rows match', () => {
    const rows = buildSideBySideRows([makeHunk([
      { type: 'context', content: 'hello world', oldLineNumber: 1, newLineNumber: 1 },
    ])])
    expect(computeSbsSearchMatches(rows, 'xyz')).toEqual([])
  })

  it('matches case-insensitively on left side', () => {
    const rows = buildSideBySideRows([makeHunk([
      { type: 'del', content: 'Hello World', oldLineNumber: 1 },
    ])])
    const matches = computeSbsSearchMatches(rows, 'hello')
    expect(matches).toEqual([0])
  })

  it('matches case-insensitively on right side', () => {
    const rows = buildSideBySideRows([makeHunk([
      { type: 'add', content: 'NEW FUNCTION', newLineNumber: 1 },
    ])])
    const matches = computeSbsSearchMatches(rows, 'function')
    expect(matches).toEqual([0])
  })

  it('matches on either side of paired rows', () => {
    const rows = buildSideBySideRows([makeHunk([
      { type: 'del', content: 'old code', oldLineNumber: 1 },
      { type: 'add', content: 'new stuff', newLineNumber: 1 },
    ])])
    expect(computeSbsSearchMatches(rows, 'code')).toEqual([0])
    expect(computeSbsSearchMatches(rows, 'stuff')).toEqual([0])
  })

  it('skips header rows', () => {
    const rows = buildSideBySideRows([makeHunk([
      { type: 'header', content: '@@ contains search @@' },
      { type: 'context', content: 'no match', oldLineNumber: 1, newLineNumber: 1 },
    ])])
    expect(computeSbsSearchMatches(rows, 'contains')).toEqual([])
  })

  it('skips comment rows', () => {
    const thread: DiffCommentThread = {
      comments: [{
        id: 1,
        body: 'searchable comment',
        user: { login: 'alice', avatar_url: '', id: 1 },
        path: 'test.ts',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        html_url: 'https://example.com',
      } as DiffCommentThread['comments'][number]],
    }
    const commentsByLine = new Map<string, DiffCommentThread>([['RIGHT:1', thread]])
    const rows = buildSideBySideRows([makeHunk([
      { type: 'add', content: 'new line', newLineNumber: 1 },
    ])], commentsByLine)
    expect(computeSbsSearchMatches(rows, 'searchable')).toEqual([])
  })

  it('returns correct indices for multiple matches', () => {
    const rows = buildSideBySideRows([makeHunk([
      { type: 'context', content: 'alpha', oldLineNumber: 1, newLineNumber: 1 },
      { type: 'context', content: 'beta', oldLineNumber: 2, newLineNumber: 2 },
      { type: 'context', content: 'alpha again', oldLineNumber: 3, newLineNumber: 3 },
    ])])
    const matches = computeSbsSearchMatches(rows, 'alpha')
    expect(matches).toEqual([0, 2])
  })
})
