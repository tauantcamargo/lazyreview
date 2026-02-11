import { describe, it, expect } from 'vitest'
import { Schema as S } from 'effect'
import { Commit, CommitDetails, CommitAuthor } from './commit'

const validCommitAuthor = {
  name: 'John Doe',
  email: 'john@example.com',
  date: '2024-01-01T00:00:00Z',
}

const validUser = {
  login: 'johndoe',
  id: 1,
  avatar_url: 'https://avatars.githubusercontent.com/u/1',
  html_url: 'https://github.com/johndoe',
}

describe('CommitAuthor schema', () => {
  const decode = S.decodeUnknownSync(CommitAuthor)

  it('decodes a valid commit author', () => {
    const result = decode(validCommitAuthor)
    expect(result.name).toBe('John Doe')
    expect(result.email).toBe('john@example.com')
  })

  it('rejects missing fields', () => {
    expect(() => decode({ name: 'John' })).toThrow()
  })
})

describe('CommitDetails schema', () => {
  const decode = S.decodeUnknownSync(CommitDetails)

  it('decodes valid commit details', () => {
    const result = decode({
      message: 'Fix: resolve issue #42',
      author: validCommitAuthor,
    })
    expect(result.message).toBe('Fix: resolve issue #42')
    expect(result.author.name).toBe('John Doe')
  })
})

describe('Commit schema', () => {
  const decode = S.decodeUnknownSync(Commit)

  it('decodes a valid commit', () => {
    const result = decode({
      sha: 'abc123def456',
      commit: {
        message: 'feat: add new feature',
        author: validCommitAuthor,
      },
      html_url: 'https://github.com/owner/repo/commit/abc123def456',
    })
    expect(result.sha).toBe('abc123def456')
    expect(result.commit.message).toBe('feat: add new feature')
    expect(result.author).toBeNull()
  })

  it('decodes a commit with GitHub user', () => {
    const result = decode({
      sha: 'abc123',
      commit: {
        message: 'feat: something',
        author: validCommitAuthor,
      },
      author: validUser,
      html_url: 'https://github.com/owner/repo/commit/abc123',
    })
    expect(result.author?.login).toBe('johndoe')
  })

  it('handles null author gracefully', () => {
    const result = decode({
      sha: 'abc123',
      commit: {
        message: 'feat: something',
        author: validCommitAuthor,
      },
      author: null,
      html_url: 'https://github.com/owner/repo/commit/abc123',
    })
    expect(result.author).toBeNull()
  })
})
