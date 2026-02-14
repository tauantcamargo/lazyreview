import { describe, it, expect } from 'vitest'
import { GiteaReviewSchema } from './review'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validUser = {
  id: 1,
  login: 'janedoe',
  full_name: 'Jane Doe',
  avatar_url: 'https://gitea.example.com/avatars/1',
}

const validReview = {
  id: 10,
  user: validUser,
  body: 'Looks good to me!',
  state: 'APPROVED',
  submitted_at: '2026-01-15T10:00:00Z',
  html_url: 'https://gitea.example.com/owner/repo/pulls/1#pullrequestreview-10',
  commit_id: 'abc123',
}

// ---------------------------------------------------------------------------
// GiteaReviewSchema
// ---------------------------------------------------------------------------

describe('GiteaReviewSchema', () => {
  it('parses a fully-populated review', () => {
    const result = GiteaReviewSchema.parse(validReview)
    expect(result.id).toBe(10)
    expect(result.user.login).toBe('janedoe')
    expect(result.body).toBe('Looks good to me!')
    expect(result.state).toBe('APPROVED')
    expect(result.submitted_at).toBe('2026-01-15T10:00:00Z')
    expect(result.commit_id).toBe('abc123')
  })

  it('defaults optional fields', () => {
    const minimal = {
      id: 11,
      user: { id: 1, login: 'test' },
      state: 'COMMENT',
    }
    const result = GiteaReviewSchema.parse(minimal)
    expect(result.body).toBe('')
    expect(result.submitted_at).toBeUndefined()
    expect(result.html_url).toBe('')
    expect(result.commit_id).toBe('')
  })

  it('accepts null body', () => {
    const result = GiteaReviewSchema.parse({
      ...validReview,
      body: null,
    })
    // Zod nullable().default('') only defaults on undefined, null passes through
    expect(result.body).toBeNull()
  })

  it('accepts null submitted_at', () => {
    const result = GiteaReviewSchema.parse({
      ...validReview,
      submitted_at: null,
    })
    expect(result.submitted_at).toBeNull()
  })

  it('accepts all Gitea review states', () => {
    const states = ['PENDING', 'APPROVED', 'REQUEST_CHANGES', 'COMMENT', 'REQUEST_REVIEW']
    for (const state of states) {
      const result = GiteaReviewSchema.parse({ ...validReview, state })
      expect(result.state).toBe(state)
    }
  })

  it('rejects missing id', () => {
    const { id: _, ...noId } = validReview
    expect(() => GiteaReviewSchema.parse(noId)).toThrow()
  })

  it('rejects missing user', () => {
    const { user: _, ...noUser } = validReview
    expect(() => GiteaReviewSchema.parse(noUser)).toThrow()
  })
})
