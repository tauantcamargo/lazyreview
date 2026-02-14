import { describe, it, expect } from 'vitest'
import {
  BitbucketCommentContentSchema,
  BitbucketInlineSchema,
  BitbucketCommentSchema,
} from './comment'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validUser = {
  display_name: 'Jane Doe',
  uuid: '{abc-123-def}',
  nickname: 'janedoe',
}

const validContent = {
  raw: 'This looks great!',
  markup: 'markdown',
  html: '<p>This looks great!</p>',
}

const validInline = {
  path: 'src/utils.ts',
  from: null,
  to: 15,
}

const minimalComment = {
  id: 100,
  content: { raw: 'Looks good to me!' },
  user: validUser,
  created_on: '2026-01-15T10:00:00Z',
  updated_on: '2026-01-15T10:00:00Z',
}

// ---------------------------------------------------------------------------
// BitbucketCommentContentSchema
// ---------------------------------------------------------------------------

describe('BitbucketCommentContentSchema', () => {
  it('parses full content', () => {
    const result = BitbucketCommentContentSchema.parse(validContent)
    expect(result.raw).toBe('This looks great!')
    expect(result.markup).toBe('markdown')
    expect(result.html).toBe('<p>This looks great!</p>')
  })

  it('parses minimal content (only raw)', () => {
    const result = BitbucketCommentContentSchema.parse({ raw: 'Hello' })
    expect(result.raw).toBe('Hello')
    expect(result.markup).toBeUndefined()
    expect(result.html).toBeUndefined()
  })

  it('rejects missing raw', () => {
    expect(() =>
      BitbucketCommentContentSchema.parse({ markup: 'markdown' }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// BitbucketInlineSchema
// ---------------------------------------------------------------------------

describe('BitbucketInlineSchema', () => {
  it('parses a valid inline position', () => {
    const result = BitbucketInlineSchema.parse(validInline)
    expect(result.path).toBe('src/utils.ts')
    expect(result.from).toBeNull()
    expect(result.to).toBe(15)
  })

  it('parses inline on old side only', () => {
    const result = BitbucketInlineSchema.parse({
      path: 'src/old.ts',
      from: 10,
      to: null,
    })
    expect(result.from).toBe(10)
    expect(result.to).toBeNull()
  })

  it('parses inline without from/to', () => {
    const result = BitbucketInlineSchema.parse({ path: 'src/file.ts' })
    expect(result.from).toBeUndefined()
    expect(result.to).toBeUndefined()
  })

  it('rejects missing path', () => {
    expect(() =>
      BitbucketInlineSchema.parse({ from: 10, to: 15 }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// BitbucketCommentSchema
// ---------------------------------------------------------------------------

describe('BitbucketCommentSchema', () => {
  it('parses a minimal comment', () => {
    const result = BitbucketCommentSchema.parse(minimalComment)
    expect(result.id).toBe(100)
    expect(result.content.raw).toBe('Looks good to me!')
    expect(result.user.display_name).toBe('Jane Doe')
    expect(result.deleted).toBe(false)
    expect(result.parent).toBeUndefined()
    expect(result.inline).toBeUndefined()
  })

  it('parses a full inline comment', () => {
    const result = BitbucketCommentSchema.parse({
      ...minimalComment,
      content: validContent,
      inline: validInline,
      parent: { id: 50 },
      deleted: false,
    })
    expect(result.inline?.path).toBe('src/utils.ts')
    expect(result.inline?.to).toBe(15)
    expect(result.parent?.id).toBe(50)
  })

  it('parses a deleted comment', () => {
    const result = BitbucketCommentSchema.parse({
      ...minimalComment,
      deleted: true,
    })
    expect(result.deleted).toBe(true)
  })

  it('accepts null parent', () => {
    const result = BitbucketCommentSchema.parse({
      ...minimalComment,
      parent: null,
    })
    expect(result.parent).toBeNull()
  })

  it('accepts null inline', () => {
    const result = BitbucketCommentSchema.parse({
      ...minimalComment,
      inline: null,
    })
    expect(result.inline).toBeNull()
  })

  it('rejects missing id', () => {
    const { id: _, ...noId } = minimalComment
    expect(() => BitbucketCommentSchema.parse(noId)).toThrow()
  })

  it('rejects missing content', () => {
    const { content: _, ...noContent } = minimalComment
    expect(() => BitbucketCommentSchema.parse(noContent)).toThrow()
  })

  it('rejects missing user', () => {
    const { user: _, ...noUser } = minimalComment
    expect(() => BitbucketCommentSchema.parse(noUser)).toThrow()
  })

  it('rejects non-number id', () => {
    expect(() =>
      BitbucketCommentSchema.parse({ ...minimalComment, id: 'abc' }),
    ).toThrow()
  })
})
