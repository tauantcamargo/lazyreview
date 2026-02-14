import { describe, it, expect } from 'vitest'
import { BitbucketCommitSchema } from './commit'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validUser = {
  display_name: 'Jane Doe',
  uuid: '{abc-123-def}',
  nickname: 'janedoe',
}

const validCommit = {
  hash: 'abc123def456abc123def456abc123def456abc1',
  message: 'feat: add dark mode\n\nFull description here.',
  date: '2026-01-15T10:00:00Z',
  author: {
    raw: 'Jane Doe <jane@example.com>',
  },
}

// ---------------------------------------------------------------------------
// BitbucketCommitSchema
// ---------------------------------------------------------------------------

describe('BitbucketCommitSchema', () => {
  it('parses a minimal commit', () => {
    const result = BitbucketCommitSchema.parse(validCommit)
    expect(result.hash).toBe('abc123def456abc123def456abc123def456abc1')
    expect(result.message).toContain('feat: add dark mode')
    expect(result.date).toBe('2026-01-15T10:00:00Z')
    expect(result.author.raw).toBe('Jane Doe <jane@example.com>')
    expect(result.author.user).toBeUndefined()
  })

  it('parses a commit with linked user', () => {
    const result = BitbucketCommitSchema.parse({
      ...validCommit,
      author: {
        raw: 'Jane Doe <jane@example.com>',
        user: validUser,
      },
    })
    expect(result.author.user?.display_name).toBe('Jane Doe')
    expect(result.author.user?.uuid).toBe('{abc-123-def}')
  })

  it('parses a commit with html link', () => {
    const result = BitbucketCommitSchema.parse({
      ...validCommit,
      links: {
        html: { href: 'https://bitbucket.org/team/repo/commits/abc123' },
      },
    })
    expect(result.links?.html?.href).toBe(
      'https://bitbucket.org/team/repo/commits/abc123',
    )
  })

  it('parses a commit without links', () => {
    const result = BitbucketCommitSchema.parse(validCommit)
    expect(result.links).toBeUndefined()
  })

  it('parses a commit with empty links', () => {
    const result = BitbucketCommitSchema.parse({
      ...validCommit,
      links: {},
    })
    expect(result.links?.html).toBeUndefined()
  })

  it('rejects missing hash', () => {
    const { hash: _, ...noHash } = validCommit
    expect(() => BitbucketCommitSchema.parse(noHash)).toThrow()
  })

  it('rejects missing message', () => {
    const { message: _, ...noMessage } = validCommit
    expect(() => BitbucketCommitSchema.parse(noMessage)).toThrow()
  })

  it('rejects missing date', () => {
    const { date: _, ...noDate } = validCommit
    expect(() => BitbucketCommitSchema.parse(noDate)).toThrow()
  })

  it('rejects missing author', () => {
    const { author: _, ...noAuthor } = validCommit
    expect(() => BitbucketCommitSchema.parse(noAuthor)).toThrow()
  })

  it('rejects non-string hash', () => {
    expect(() =>
      BitbucketCommitSchema.parse({ ...validCommit, hash: 12345 }),
    ).toThrow()
  })

  it('rejects missing author.raw', () => {
    expect(() =>
      BitbucketCommitSchema.parse({ ...validCommit, author: {} }),
    ).toThrow()
  })
})
