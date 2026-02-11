import { describe, it, expect } from 'vitest'
import { Schema as S } from 'effect'
import { IssueComment } from './issue-comment'

const validUser = {
  login: 'octocat',
  id: 1,
  avatar_url: 'https://avatars.githubusercontent.com/u/1',
  html_url: 'https://github.com/octocat',
}

const validIssueComment = {
  id: 200,
  node_id: 'IC_kwDOAbcdef',
  body: 'This is a general PR comment',
  user: validUser,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-02T00:00:00Z',
  html_url: 'https://github.com/owner/repo/issues/42#issuecomment-200',
}

describe('IssueComment schema', () => {
  const decode = S.decodeUnknownSync(IssueComment)

  it('decodes a valid issue comment', () => {
    const result = decode(validIssueComment)
    expect(result.id).toBe(200)
    expect(result.body).toBe('This is a general PR comment')
    expect(result.user.login).toBe('octocat')
    expect(result.html_url).toBe(
      'https://github.com/owner/repo/issues/42#issuecomment-200',
    )
  })

  it('decodes without optional node_id', () => {
    const { node_id: _, ...withoutNodeId } = validIssueComment
    const result = decode(withoutNodeId)
    expect(result.id).toBe(200)
    expect(result.node_id).toBeUndefined()
  })

  it('rejects missing required fields', () => {
    expect(() => decode({ id: 200 })).toThrow()
  })

  it('rejects missing body', () => {
    const { body: _, ...withoutBody } = validIssueComment
    expect(() => decode(withoutBody)).toThrow()
  })

  it('rejects missing user', () => {
    const { user: _, ...withoutUser } = validIssueComment
    expect(() => decode(withoutUser)).toThrow()
  })

  it('rejects invalid user shape', () => {
    expect(() =>
      decode({ ...validIssueComment, user: { name: 'bad' } }),
    ).toThrow()
  })
})
