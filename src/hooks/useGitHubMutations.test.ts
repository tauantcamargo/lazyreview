import { describe, it, expect } from 'vitest'
import {
  createGitHubMutation,
  invalidatePRLists,
  invalidatePRComments,
  invalidatePRThreads,
} from './useGitHubMutations'

describe('createGitHubMutation', () => {
  it('returns a function (hook creator)', () => {
    const hook = createGitHubMutation({
      effect: (api) => api.getMyPRs(),
    })
    expect(typeof hook).toBe('function')
  })

  it('accepts invalidateKeys as a function', () => {
    const hook = createGitHubMutation<{ owner: string; repo: string; prNumber: number }>({
      effect: (api, params) => api.closePR(params.owner, params.repo, params.prNumber),
      invalidateKeys: (params) => [['pr', params.owner, params.repo, String(params.prNumber)]],
    })
    expect(typeof hook).toBe('function')
  })

  it('accepts no invalidateKeys', () => {
    const hook = createGitHubMutation<{ owner: string; repo: string; prNumber: number }>({
      effect: (api, params) => api.discardPendingReview(params.owner, params.repo, params.prNumber, 1),
    })
    expect(typeof hook).toBe('function')
  })
})

describe('invalidatePRLists', () => {
  it('returns the four PR list query keys', () => {
    const keys = invalidatePRLists()
    expect(keys).toEqual([
      ['prs'],
      ['my-prs'],
      ['review-requests'],
      ['involved-prs'],
    ])
  })
})

describe('invalidatePRComments', () => {
  it('returns query key with owner, repo, prNumber', () => {
    const keys = invalidatePRComments('octocat', 'hello', 42)
    expect(keys).toEqual([['pr-comments', 'octocat', 'hello', 42]])
  })
})

describe('invalidatePRThreads', () => {
  it('returns comments and threads query keys', () => {
    const keys = invalidatePRThreads('octocat', 'hello', 42)
    expect(keys).toEqual([
      ['pr-comments', 'octocat', 'hello', 42],
      ['pr-review-threads', 'octocat', 'hello', 42],
    ])
  })
})
