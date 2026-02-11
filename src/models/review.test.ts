import { describe, it, expect } from 'vitest'
import { Schema as S } from 'effect'
import { Review } from './review'

const validUser = {
  login: 'reviewer',
  id: 2,
  avatar_url: 'https://avatars.githubusercontent.com/u/2',
  html_url: 'https://github.com/reviewer',
}

describe('Review schema', () => {
  const decode = S.decodeUnknownSync(Review)

  it('decodes a valid review', () => {
    const result = decode({
      id: 1,
      user: validUser,
      state: 'APPROVED',
      html_url: 'https://github.com/owner/repo/pull/42#pullrequestreview-1',
    })
    expect(result.state).toBe('APPROVED')
    expect(result.body).toBeNull()
    expect(result.submitted_at).toBeNull()
  })

  it('decodes all valid review states', () => {
    const states = ['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED', 'DISMISSED', 'PENDING'] as const
    for (const state of states) {
      const result = decode({
        id: 1,
        user: validUser,
        state,
        html_url: 'https://github.com/owner/repo/pull/42',
      })
      expect(result.state).toBe(state)
    }
  })

  it('rejects invalid review state', () => {
    expect(() =>
      decode({
        id: 1,
        user: validUser,
        state: 'REJECTED',
        html_url: 'https://github.com/owner/repo/pull/42',
      }),
    ).toThrow()
  })

  it('decodes review with body and submitted_at', () => {
    const result = decode({
      id: 1,
      user: validUser,
      body: 'LGTM',
      state: 'APPROVED',
      submitted_at: '2024-01-01T00:00:00Z',
      html_url: 'https://github.com/owner/repo/pull/42',
    })
    expect(result.body).toBe('LGTM')
    expect(result.submitted_at).toBe('2024-01-01T00:00:00Z')
  })
})
