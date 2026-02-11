import { describe, it, expect } from 'vitest'
import { Schema as S } from 'effect'
import { Comment } from './comment'

const validUser = {
  login: 'octocat',
  id: 1,
  avatar_url: 'https://avatars.githubusercontent.com/u/1',
  html_url: 'https://github.com/octocat',
}

const validComment = {
  id: 100,
  body: 'Looks good to me!',
  user: validUser,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
  html_url: 'https://github.com/owner/repo/pull/42#issuecomment-100',
}

describe('Comment schema', () => {
  const decode = S.decodeUnknownSync(Comment)

  it('decodes a valid comment', () => {
    const result = decode(validComment)
    expect(result.id).toBe(100)
    expect(result.body).toBe('Looks good to me!')
    expect(result.user.login).toBe('octocat')
  })

  it('decodes a review comment with path and line', () => {
    const reviewComment = {
      ...validComment,
      path: 'src/index.ts',
      line: 42,
      side: 'RIGHT' as const,
      in_reply_to_id: 99,
    }
    const result = decode(reviewComment)
    expect(result.path).toBe('src/index.ts')
    expect(result.line).toBe(42)
    expect(result.side).toBe('RIGHT')
  })

  it('rejects missing required fields', () => {
    expect(() => decode({ id: 100 })).toThrow()
  })

  it('rejects invalid side value', () => {
    expect(() => decode({ ...validComment, side: 'CENTER' })).toThrow()
  })
})
