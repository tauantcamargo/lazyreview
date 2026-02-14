import { describe, it, expect } from 'vitest'
import { GiteaCommitInfoSchema, GiteaCommitSchema } from './commit'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validUser = {
  id: 1,
  login: 'janedoe',
  full_name: 'Jane Doe',
  avatar_url: 'https://gitea.example.com/avatars/1',
}

const validCommitInfo = {
  message: 'feat: add dark mode',
  author: {
    name: 'Jane Doe',
    email: 'jane@example.com',
    date: '2026-01-15T10:00:00Z',
  },
}

const validCommit = {
  sha: 'abc123def456789',
  commit: validCommitInfo,
  author: validUser,
  html_url: 'https://gitea.example.com/owner/repo/commit/abc123def456789',
}

// ---------------------------------------------------------------------------
// GiteaCommitInfoSchema
// ---------------------------------------------------------------------------

describe('GiteaCommitInfoSchema', () => {
  it('parses a valid commit info', () => {
    const result = GiteaCommitInfoSchema.parse(validCommitInfo)
    expect(result.message).toBe('feat: add dark mode')
    expect(result.author.name).toBe('Jane Doe')
    expect(result.author.email).toBe('jane@example.com')
    expect(result.author.date).toBe('2026-01-15T10:00:00Z')
  })

  it('rejects missing message', () => {
    expect(() =>
      GiteaCommitInfoSchema.parse({ author: validCommitInfo.author }),
    ).toThrow()
  })

  it('rejects missing author', () => {
    expect(() =>
      GiteaCommitInfoSchema.parse({ message: 'test' }),
    ).toThrow()
  })

  it('rejects missing author.name', () => {
    expect(() =>
      GiteaCommitInfoSchema.parse({
        message: 'test',
        author: { email: 'test@example.com', date: '2026-01-15T10:00:00Z' },
      }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// GiteaCommitSchema
// ---------------------------------------------------------------------------

describe('GiteaCommitSchema', () => {
  it('parses a fully-populated commit', () => {
    const result = GiteaCommitSchema.parse(validCommit)
    expect(result.sha).toBe('abc123def456789')
    expect(result.commit.message).toBe('feat: add dark mode')
    expect(result.commit.author.name).toBe('Jane Doe')
    expect(result.author?.login).toBe('janedoe')
    expect(result.html_url).toBe(
      'https://gitea.example.com/owner/repo/commit/abc123def456789',
    )
  })

  it('parses a commit with null author', () => {
    const result = GiteaCommitSchema.parse({
      ...validCommit,
      author: null,
    })
    expect(result.author).toBeNull()
  })

  it('parses a commit without optional author', () => {
    const { author: _, ...noAuthor } = validCommit
    const result = GiteaCommitSchema.parse(noAuthor)
    expect(result.author).toBeUndefined()
  })

  it('defaults html_url when missing', () => {
    const { html_url: _, ...noUrl } = validCommit
    const result = GiteaCommitSchema.parse(noUrl)
    expect(result.html_url).toBe('')
  })

  it('rejects missing sha', () => {
    const { sha: _, ...noSha } = validCommit
    expect(() => GiteaCommitSchema.parse(noSha)).toThrow()
  })

  it('rejects missing commit', () => {
    const { commit: _, ...noCommit } = validCommit
    expect(() => GiteaCommitSchema.parse(noCommit)).toThrow()
  })
})
