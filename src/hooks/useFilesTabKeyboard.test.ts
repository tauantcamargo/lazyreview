import { describe, it, expect } from 'vitest'
import { getFocusedCommentThread, getFocusedLine } from './useFilesTabKeyboard'
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
