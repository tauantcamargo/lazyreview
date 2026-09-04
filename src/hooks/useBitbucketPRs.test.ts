import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Effect } from 'effect'
import { matchesScope, fetchBitbucketPRs } from './useBitbucketPRs'
import type { PullRequest } from '../models/pull-request'

const getTokenForProvider = vi.fn()
const getUserForProvider = vi.fn()
vi.mock('../services/Auth', () => ({
  getTokenForProvider: (...args: unknown[]) => getTokenForProvider(...args),
  getUserForProvider: (...args: unknown[]) => getUserForProvider(...args),
}))

const listPRsMock = vi.fn()
const createBitbucketProvider = vi.fn()
vi.mock('../services/providers/bitbucket', () => ({
  createBitbucketProvider: (...args: unknown[]) =>
    createBitbucketProvider(...args),
}))

function makePR(
  overrides: Partial<{
    readonly login: string
    readonly reviewers: readonly string[]
  }> = {},
): PullRequest {
  const { login = 'alice', reviewers = [] } = overrides
  return {
    id: 1,
    number: 1,
    title: 'PR',
    state: 'open',
    user: { login, id: 1, avatar_url: '', html_url: '', type: 'User' },
    labels: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    html_url: 'https://bitbucket.org/acme/web/pull-requests/1',
    requested_reviewers: reviewers.map((r) => ({
      login: r,
      id: 1,
      avatar_url: '',
      html_url: '',
      type: 'User',
    })),
    assignees: [],
    provider: 'bitbucket',
  } as unknown as PullRequest
}

describe('matchesScope', () => {
  const pr = makePR({ login: 'alice', reviewers: ['bob'] })

  it('"my" matches the author only', () => {
    expect(matchesScope(pr, 'my', 'alice')).toBe(true)
    expect(matchesScope(pr, 'my', 'bob')).toBe(false)
  })

  it('"review-requested" matches a requested reviewer only', () => {
    expect(matchesScope(pr, 'review-requested', 'bob')).toBe(true)
    expect(matchesScope(pr, 'review-requested', 'alice')).toBe(false)
  })

  it('"involved" matches either author or reviewer', () => {
    expect(matchesScope(pr, 'involved', 'alice')).toBe(true)
    expect(matchesScope(pr, 'involved', 'bob')).toBe(true)
    expect(matchesScope(pr, 'involved', 'carol')).toBe(false)
  })
})

describe('fetchBitbucketPRs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getTokenForProvider.mockReturnValue(Effect.succeed('user@example.com:tok'))
    getUserForProvider.mockReturnValue(Effect.succeed({ login: 'alice' }))
    listPRsMock.mockReturnValue(Effect.succeed({ items: [] }))
    createBitbucketProvider.mockReturnValue({ listPRs: listPRsMock })
  })

  it('returns an empty, non-error result when there are no bookmarked repos', async () => {
    const result = await Effect.runPromise(
      fetchBitbucketPRs([], 'involved', 'open'),
    )
    expect(result).toEqual({ prs: [], authError: false })
    expect(getTokenForProvider).not.toHaveBeenCalled()
  })

  it('reports authError without throwing when no bitbucket token is available', async () => {
    getTokenForProvider.mockReturnValue(
      Effect.fail({ _tag: 'AuthError', message: 'no token' }),
    )
    const result = await Effect.runPromise(
      fetchBitbucketPRs([{ owner: 'acme', repo: 'web' }], 'involved', 'open'),
    )
    expect(result).toEqual({ prs: [], authError: true })
  })

  it('reports authError when the token is rejected fetching the current user', async () => {
    getUserForProvider.mockReturnValue(
      Effect.fail({ _tag: 'AuthError', message: 'invalid token' }),
    )
    const result = await Effect.runPromise(
      fetchBitbucketPRs([{ owner: 'acme', repo: 'web' }], 'involved', 'open'),
    )
    expect(result).toEqual({ prs: [], authError: true })
  })

  it('fans out across bookmarked repos and filters by scope', async () => {
    listPRsMock
      .mockReturnValueOnce(
        Effect.succeed({ items: [makePR({ login: 'alice' })] }),
      )
      .mockReturnValueOnce(
        Effect.succeed({ items: [makePR({ login: 'someone-else' })] }),
      )

    const result = await Effect.runPromise(
      fetchBitbucketPRs(
        [
          { owner: 'acme', repo: 'web' },
          { owner: 'acme', repo: 'api' },
        ],
        'my',
        'open',
      ),
    )

    expect(result.authError).toBe(false)
    expect(result.prs).toHaveLength(1)
    expect(result.prs[0]?.user.login).toBe('alice')
    expect(createBitbucketProvider).toHaveBeenCalledTimes(2)
  })

  it('skips a repo that fails without dropping the others (partial failure)', async () => {
    listPRsMock
      .mockReturnValueOnce(
        Effect.fail({ _tag: 'BitbucketError', message: 'not found' }),
      )
      .mockReturnValueOnce(
        Effect.succeed({ items: [makePR({ login: 'alice' })] }),
      )

    const result = await Effect.runPromise(
      fetchBitbucketPRs(
        [
          { owner: 'acme', repo: 'renamed-or-gone' },
          { owner: 'acme', repo: 'web' },
        ],
        'my',
        'open',
      ),
    )

    expect(result.authError).toBe(false)
    expect(result.prs).toHaveLength(1)
  })
})
