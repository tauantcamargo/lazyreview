import { describe, it, expect } from 'vitest'
import {
  AzureCommentSchema,
  AzureThreadContextSchema,
  AzureThreadSchema,
} from './comment'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validAuthor = {
  id: 'author-1',
  displayName: 'Jane Doe',
  uniqueName: 'jane@example.com',
}

const validComment = {
  id: 1,
  content: 'This looks great!',
  publishedDate: '2026-01-15T10:00:00Z',
  lastUpdatedDate: '2026-01-15T10:00:00Z',
  commentType: 'text' as const,
  author: validAuthor,
}

const validThreadContext = {
  filePath: '/src/utils.ts',
  rightFileStart: { line: 15, offset: 1 },
  rightFileEnd: { line: 15, offset: 1 },
}

const validThread = {
  id: 100,
  publishedDate: '2026-01-15T10:00:00Z',
  lastUpdatedDate: '2026-01-15T10:00:00Z',
  comments: [validComment],
  status: 'active' as const,
}

// ---------------------------------------------------------------------------
// AzureCommentSchema
// ---------------------------------------------------------------------------

describe('AzureCommentSchema', () => {
  it('parses a fully-populated comment', () => {
    const result = AzureCommentSchema.parse(validComment)
    expect(result.id).toBe(1)
    expect(result.content).toBe('This looks great!')
    expect(result.commentType).toBe('text')
    expect(result.author.displayName).toBe('Jane Doe')
  })

  it('defaults parentCommentId to 0', () => {
    const result = AzureCommentSchema.parse(validComment)
    expect(result.parentCommentId).toBe(0)
  })

  it('defaults content to empty string', () => {
    const { content: _, ...noContent } = validComment
    const result = AzureCommentSchema.parse(noContent)
    expect(result.content).toBe('')
  })

  it('parses a reply comment with parentCommentId', () => {
    const result = AzureCommentSchema.parse({
      ...validComment,
      id: 2,
      parentCommentId: 1,
    })
    expect(result.parentCommentId).toBe(1)
  })

  it('parses all valid comment types', () => {
    const types = ['text', 'codeChange', 'system', 'unknown'] as const
    for (const commentType of types) {
      const result = AzureCommentSchema.parse({ ...validComment, commentType })
      expect(result.commentType).toBe(commentType)
    }
  })

  it('rejects missing author', () => {
    const { author: _, ...noAuthor } = validComment
    expect(() => AzureCommentSchema.parse(noAuthor)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// AzureThreadContextSchema
// ---------------------------------------------------------------------------

describe('AzureThreadContextSchema', () => {
  it('parses a right-side context', () => {
    const result = AzureThreadContextSchema.parse(validThreadContext)
    expect(result.filePath).toBe('/src/utils.ts')
    expect(result.rightFileStart?.line).toBe(15)
    expect(result.rightFileEnd?.line).toBe(15)
  })

  it('parses a left-side context', () => {
    const result = AzureThreadContextSchema.parse({
      filePath: '/src/old.ts',
      leftFileStart: { line: 10, offset: 1 },
      leftFileEnd: { line: 10, offset: 1 },
    })
    expect(result.filePath).toBe('/src/old.ts')
    expect(result.leftFileStart?.line).toBe(10)
    expect(result.rightFileStart).toBeUndefined()
  })

  it('accepts null positions', () => {
    const result = AzureThreadContextSchema.parse({
      filePath: '/src/test.ts',
      rightFileStart: null,
      rightFileEnd: null,
      leftFileStart: null,
      leftFileEnd: null,
    })
    expect(result.rightFileStart).toBeNull()
    expect(result.leftFileStart).toBeNull()
  })

  it('rejects missing filePath', () => {
    expect(() =>
      AzureThreadContextSchema.parse({ rightFileStart: { line: 1, offset: 1 } }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// AzureThreadSchema
// ---------------------------------------------------------------------------

describe('AzureThreadSchema', () => {
  it('parses a minimal thread', () => {
    const result = AzureThreadSchema.parse(validThread)
    expect(result.id).toBe(100)
    expect(result.comments).toHaveLength(1)
    expect(result.status).toBe('active')
  })

  it('defaults isDeleted to false', () => {
    const result = AzureThreadSchema.parse(validThread)
    expect(result.isDeleted).toBe(false)
  })

  it('defaults comments to empty array', () => {
    const result = AzureThreadSchema.parse({
      id: 200,
    })
    expect(result.comments).toEqual([])
  })

  it('parses a thread with threadContext', () => {
    const result = AzureThreadSchema.parse({
      ...validThread,
      threadContext: validThreadContext,
    })
    expect(result.threadContext?.filePath).toBe('/src/utils.ts')
  })

  it('accepts null threadContext', () => {
    const result = AzureThreadSchema.parse({
      ...validThread,
      threadContext: null,
    })
    expect(result.threadContext).toBeNull()
  })

  it('parses all valid statuses', () => {
    const statuses = [
      'active',
      'byDesign',
      'closed',
      'fixed',
      'pending',
      'unknown',
      'wontFix',
    ] as const
    for (const status of statuses) {
      const result = AzureThreadSchema.parse({ ...validThread, status })
      expect(result.status).toBe(status)
    }
  })

  it('parses a deleted thread', () => {
    const result = AzureThreadSchema.parse({
      ...validThread,
      isDeleted: true,
    })
    expect(result.isDeleted).toBe(true)
  })
})
