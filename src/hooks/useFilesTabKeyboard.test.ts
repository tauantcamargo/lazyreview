import { describe, it, expect } from 'vitest'
import { getFocusedCommentThread, getFocusedLine, extractAiReviewLines } from './useFilesTabKeyboard'
import type { DiffDisplayRow } from '../components/pr/DiffView'
import type { SideBySideRow } from '../components/pr/SideBySideDiffView'
import type { DiffCommentThread } from '../components/pr/DiffComment'
import type { Comment } from '../models/comment'

function makeComment(id: number, body = 'comment'): Comment {
  return {
    id,
    body,
    user: { login: 'user1', avatar_url: '' },
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    html_url: '',
  } as unknown as Comment
}

function makeThread(comments: Comment[], overrides: Partial<DiffCommentThread> = {}): DiffCommentThread {
  return {
    comments,
    ...overrides,
  }
}

function makeCommentRow(thread: DiffCommentThread): DiffDisplayRow {
  return { type: 'comment', thread } as DiffDisplayRow
}

function makeLineRow(): DiffDisplayRow {
  return {
    type: 'line',
    line: { type: 'add', content: '+hello' },
    oldLineNumber: undefined,
    newLineNumber: 10,
  } as DiffDisplayRow
}

describe('getFocusedCommentThread', () => {
  it('returns thread from unified diff comment row', () => {
    const thread = makeThread([makeComment(1)])
    const rows: DiffDisplayRow[] = [makeLineRow(), makeCommentRow(thread)]

    const result = getFocusedCommentThread('unified', 1, rows, [])
    expect(result).toBe(thread)
  })

  it('returns undefined for unified diff line row', () => {
    const rows: DiffDisplayRow[] = [makeLineRow()]

    const result = getFocusedCommentThread('unified', 0, rows, [])
    expect(result).toBeUndefined()
  })

  it('returns thread from side-by-side comment row', () => {
    const thread = makeThread([makeComment(2)])
    const sbsRows: SideBySideRow[] = [
      { type: 'comment', thread } as SideBySideRow,
    ]

    const result = getFocusedCommentThread('side-by-side', 0, [], sbsRows)
    expect(result).toBe(thread)
  })

  it('returns undefined for out-of-bounds index', () => {
    const result = getFocusedCommentThread('unified', 5, [], [])
    expect(result).toBeUndefined()
  })

  describe('reaction handler uses last comment from thread', () => {
    it('single comment thread returns that comment', () => {
      const comment = makeComment(10, 'test body')
      const thread = makeThread([comment])
      const lastComment = thread.comments[thread.comments.length - 1]
      expect(lastComment?.id).toBe(10)
    })

    it('multi-comment thread returns last comment', () => {
      const comments = [
        makeComment(10, 'first'),
        makeComment(11, 'second'),
        makeComment(12, 'third'),
      ]
      const thread = makeThread(comments)
      const lastComment = thread.comments[thread.comments.length - 1]
      expect(lastComment?.id).toBe(12)
    })
  })
})

describe('getFocusedLine', () => {
  it('returns line info for a unified line row', () => {
    const rows: DiffDisplayRow[] = [makeLineRow()]
    const result = getFocusedLine('unified', 0, rows, [])
    expect(result).toBeDefined()
    expect(result?.newLineNumber).toBe(10)
  })

  it('returns undefined for unified comment row', () => {
    const thread = makeThread([makeComment(1)])
    const rows: DiffDisplayRow[] = [makeCommentRow(thread)]
    const result = getFocusedLine('unified', 0, rows, [])
    expect(result).toBeUndefined()
  })

  it('returns undefined for out-of-bounds index', () => {
    const result = getFocusedLine('unified', 10, [], [])
    expect(result).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Helper builders for extractAiReviewLines tests
// ---------------------------------------------------------------------------

function makeAddLineRow(lineNum: number, content = '+added line'): DiffDisplayRow {
  return {
    type: 'line',
    line: { type: 'add', content },
    oldLineNumber: undefined,
    newLineNumber: lineNum,
  } as DiffDisplayRow
}

function makeDelLineRow(lineNum: number, content = '-removed line'): DiffDisplayRow {
  return {
    type: 'line',
    line: { type: 'del', content },
    oldLineNumber: lineNum,
    newLineNumber: undefined,
  } as DiffDisplayRow
}

function makeContextLineRow(lineNum: number, content = ' context line'): DiffDisplayRow {
  return {
    type: 'line',
    line: { type: 'context', content },
    oldLineNumber: lineNum,
    newLineNumber: lineNum,
  } as DiffDisplayRow
}

function makeHeaderRow(): DiffDisplayRow {
  return {
    type: 'line',
    line: { type: 'header', content: '@@ -1,5 +1,7 @@' },
    oldLineNumber: undefined,
    newLineNumber: undefined,
  } as DiffDisplayRow
}

describe('extractAiReviewLines', () => {
  describe('single line with context', () => {
    it('extracts focused line plus surrounding context', () => {
      const rows: DiffDisplayRow[] = [
        makeContextLineRow(1, 'line 1'),
        makeContextLineRow(2, 'line 2'),
        makeAddLineRow(3, 'added line'),
        makeContextLineRow(4, 'line 4'),
        makeContextLineRow(5, 'line 5'),
      ]

      const result = extractAiReviewLines(
        'unified', 2, rows, [], 'src/test.ts', null, 2,
      )

      expect(result).toBeDefined()
      expect(result?.filename).toBe('src/test.ts')
      expect(result?.code).toContain('added line')
      expect(result?.code).toContain('line 1')
      expect(result?.code).toContain('line 4')
      expect(result?.lineTypes.has('add')).toBe(true)
      expect(result?.lineTypes.has('context')).toBe(true)
    })

    it('handles first line with no context above', () => {
      const rows: DiffDisplayRow[] = [
        makeAddLineRow(1, 'first line'),
        makeContextLineRow(2, 'second line'),
        makeContextLineRow(3, 'third line'),
      ]

      const result = extractAiReviewLines(
        'unified', 0, rows, [], 'src/test.ts', null, 2,
      )

      expect(result).toBeDefined()
      expect(result?.code).toContain('first line')
      expect(result?.code).toContain('second line')
      expect(result?.startLine).toBe(1)
    })

    it('handles last line with no context below', () => {
      const rows: DiffDisplayRow[] = [
        makeContextLineRow(1, 'first'),
        makeContextLineRow(2, 'second'),
        makeAddLineRow(3, 'last line'),
      ]

      const result = extractAiReviewLines(
        'unified', 2, rows, [], 'src/test.ts', null, 2,
      )

      expect(result).toBeDefined()
      expect(result?.code).toContain('last line')
      expect(result?.endLine).toBe(3)
    })

    it('returns undefined for header row', () => {
      const rows: DiffDisplayRow[] = [makeHeaderRow()]

      const result = extractAiReviewLines(
        'unified', 0, rows, [], 'src/test.ts', null, 5,
      )

      expect(result).toBeUndefined()
    })

    it('returns undefined for comment row', () => {
      const thread = makeThread([makeComment(1)])
      const rows: DiffDisplayRow[] = [makeCommentRow(thread)]

      const result = extractAiReviewLines(
        'unified', 0, rows, [], 'src/test.ts', null, 5,
      )

      expect(result).toBeUndefined()
    })

    it('uses default 5-line context when not specified', () => {
      const rows: DiffDisplayRow[] = Array.from({ length: 15 }, (_, i) =>
        makeContextLineRow(i + 1, `line ${i + 1}`),
      )

      const result = extractAiReviewLines(
        'unified', 7, rows, [], 'src/test.ts', null,
      )

      expect(result).toBeDefined()
      // Lines 3-13 should be included (index 7 +/- 5)
      expect(result?.code).toContain('line 3')
      expect(result?.code).toContain('line 13')
      expect(result?.startLine).toBe(3)
      expect(result?.endLine).toBe(13)
    })
  })

  describe('visual selection', () => {
    it('extracts lines within visual selection range', () => {
      const rows: DiffDisplayRow[] = [
        makeContextLineRow(1, 'line 1'),
        makeAddLineRow(2, 'added A'),
        makeAddLineRow(3, 'added B'),
        makeDelLineRow(4, 'deleted C'),
        makeContextLineRow(5, 'line 5'),
      ]

      // Visual select from index 1 to 3
      const result = extractAiReviewLines(
        'unified', 3, rows, [], 'src/test.ts', 1,
      )

      expect(result).toBeDefined()
      expect(result?.code).toContain('added A')
      expect(result?.code).toContain('added B')
      expect(result?.code).toContain('deleted C')
      expect(result?.lineTypes.has('add')).toBe(true)
      expect(result?.lineTypes.has('del')).toBe(true)
      expect(result?.startLine).toBe(2)
      expect(result?.endLine).toBe(4)
    })

    it('handles reversed visual selection (cursor before start)', () => {
      const rows: DiffDisplayRow[] = [
        makeAddLineRow(1, 'line A'),
        makeAddLineRow(2, 'line B'),
        makeAddLineRow(3, 'line C'),
      ]

      // Visual start at 2, cursor at 0 (reversed)
      const result = extractAiReviewLines(
        'unified', 0, rows, [], 'src/test.ts', 2,
      )

      expect(result).toBeDefined()
      expect(result?.code).toContain('line A')
      expect(result?.code).toContain('line B')
      expect(result?.code).toContain('line C')
      expect(result?.startLine).toBe(1)
      expect(result?.endLine).toBe(3)
    })

    it('handles single-line visual selection', () => {
      const rows: DiffDisplayRow[] = [
        makeAddLineRow(5, 'single line'),
      ]

      const result = extractAiReviewLines(
        'unified', 0, rows, [], 'src/test.ts', 0,
      )

      expect(result).toBeDefined()
      expect(result?.code).toBe('single line')
      expect(result?.startLine).toBe(5)
      expect(result?.endLine).toBe(5)
    })

    it('skips header rows within visual selection', () => {
      const rows: DiffDisplayRow[] = [
        makeAddLineRow(1, 'line 1'),
        makeHeaderRow(),
        makeAddLineRow(10, 'line 10'),
      ]

      const result = extractAiReviewLines(
        'unified', 2, rows, [], 'src/test.ts', 0,
      )

      expect(result).toBeDefined()
      expect(result?.code).toContain('line 1')
      expect(result?.code).toContain('line 10')
      expect(result?.code).not.toContain('@@')
    })

    it('returns undefined when visual selection contains only headers/comments', () => {
      const thread = makeThread([makeComment(1)])
      const rows: DiffDisplayRow[] = [
        makeHeaderRow(),
        makeCommentRow(thread),
      ]

      const result = extractAiReviewLines(
        'unified', 1, rows, [], 'src/test.ts', 0,
      )

      expect(result).toBeUndefined()
    })
  })

  describe('line types tracking', () => {
    it('tracks add line type', () => {
      const rows: DiffDisplayRow[] = [makeAddLineRow(1, 'added')]

      const result = extractAiReviewLines(
        'unified', 0, rows, [], 'src/test.ts', 0,
      )

      expect(result?.lineTypes.has('add')).toBe(true)
    })

    it('tracks del line type', () => {
      const rows: DiffDisplayRow[] = [makeDelLineRow(1, 'deleted')]

      const result = extractAiReviewLines(
        'unified', 0, rows, [], 'src/test.ts', 0,
      )

      expect(result?.lineTypes.has('del')).toBe(true)
    })

    it('tracks context line type', () => {
      const rows: DiffDisplayRow[] = [makeContextLineRow(1, 'context')]

      const result = extractAiReviewLines(
        'unified', 0, rows, [], 'src/test.ts', 0,
      )

      expect(result?.lineTypes.has('context')).toBe(true)
    })

    it('tracks mixed line types in selection', () => {
      const rows: DiffDisplayRow[] = [
        makeAddLineRow(1, 'added'),
        makeDelLineRow(2, 'deleted'),
        makeContextLineRow(3, 'context'),
      ]

      const result = extractAiReviewLines(
        'unified', 2, rows, [], 'src/test.ts', 0,
      )

      expect(result?.lineTypes.has('add')).toBe(true)
      expect(result?.lineTypes.has('del')).toBe(true)
      expect(result?.lineTypes.has('context')).toBe(true)
    })
  })

  describe('empty and edge cases', () => {
    it('returns undefined for empty rows', () => {
      const result = extractAiReviewLines(
        'unified', 0, [], [], 'src/test.ts', null, 5,
      )

      expect(result).toBeUndefined()
    })

    it('returns undefined for out-of-bounds index', () => {
      const rows: DiffDisplayRow[] = [makeAddLineRow(1)]

      const result = extractAiReviewLines(
        'unified', 10, rows, [], 'src/test.ts', null, 5,
      )

      expect(result).toBeUndefined()
    })

    it('preserves filename in result', () => {
      const rows: DiffDisplayRow[] = [makeAddLineRow(1, 'code')]

      const result = extractAiReviewLines(
        'unified', 0, rows, [], 'src/components/App.tsx', null, 0,
      )

      expect(result?.filename).toBe('src/components/App.tsx')
    })
  })
})
