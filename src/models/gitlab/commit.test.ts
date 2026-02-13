import { describe, it, expect } from 'vitest'
import { GitLabCommitSchema } from './commit'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validCommit = {
  id: 'abc123def456abc123def456abc123def456abc1',
  short_id: 'abc123d',
  title: 'feat: add dark mode',
  message: 'feat: add dark mode\n\nImplements dark mode toggle for the TUI.',
  author_name: 'Jane Doe',
  author_email: 'jane@example.com',
  authored_date: '2026-01-15T10:00:00Z',
  committed_date: '2026-01-15T10:05:00Z',
}

// ---------------------------------------------------------------------------
// GitLabCommitSchema
// ---------------------------------------------------------------------------

describe('GitLabCommitSchema', () => {
  it('parses a valid commit without web_url', () => {
    const result = GitLabCommitSchema.parse(validCommit)
    expect(result.id).toBe('abc123def456abc123def456abc123def456abc1')
    expect(result.short_id).toBe('abc123d')
    expect(result.title).toBe('feat: add dark mode')
    expect(result.message).toContain('Implements dark mode toggle')
    expect(result.author_name).toBe('Jane Doe')
    expect(result.author_email).toBe('jane@example.com')
    expect(result.authored_date).toBe('2026-01-15T10:00:00Z')
    expect(result.committed_date).toBe('2026-01-15T10:05:00Z')
    expect(result.web_url).toBeUndefined()
  })

  it('parses a commit with web_url', () => {
    const result = GitLabCommitSchema.parse({
      ...validCommit,
      web_url: 'https://gitlab.com/project/-/commit/abc123',
    })
    expect(result.web_url).toBe(
      'https://gitlab.com/project/-/commit/abc123',
    )
  })

  it('rejects missing id', () => {
    const { id: _, ...noId } = validCommit
    expect(() => GitLabCommitSchema.parse(noId)).toThrow()
  })

  it('rejects missing author_name', () => {
    const { author_name: _, ...noAuthor } = validCommit
    expect(() => GitLabCommitSchema.parse(noAuthor)).toThrow()
  })

  it('rejects non-string id', () => {
    expect(() =>
      GitLabCommitSchema.parse({ ...validCommit, id: 12345 }),
    ).toThrow()
  })

  it('rejects missing message', () => {
    const { message: _, ...noMessage } = validCommit
    expect(() => GitLabCommitSchema.parse(noMessage)).toThrow()
  })
})
