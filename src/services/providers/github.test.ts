import { describe, it, expect, vi } from 'vitest'
import { Effect, Exit } from 'effect'
import { createGitHubProvider, createUnsupportedProvider } from './github'
import { createProvider } from './index'
import type { CodeReviewApiService } from '../CodeReviewApiTypes'
import type { ProviderConfig } from './types'
import { GitHubError } from '../../models/errors'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockService(overrides: Partial<CodeReviewApiService> = {}): CodeReviewApiService {
  return {
    listPRs: vi.fn(() => Effect.succeed([])),
    getPR: vi.fn(() => Effect.succeed({} as never)),
    getPRFiles: vi.fn(() => Effect.succeed([])),
    getPRComments: vi.fn(() => Effect.succeed([])),
    getIssueComments: vi.fn(() => Effect.succeed([])),
    getPRReviews: vi.fn(() => Effect.succeed([])),
    getPRCommits: vi.fn(() => Effect.succeed([])),
    getMyPRs: vi.fn(() => Effect.succeed([])),
    getReviewRequests: vi.fn(() => Effect.succeed([])),
    getInvolvedPRs: vi.fn(() => Effect.succeed([])),
    getPRChecks: vi.fn(() => Effect.succeed({ total_count: 0, check_runs: [] } as never)),
    submitReview: vi.fn(() => Effect.succeed(undefined as void)),
    addComment: vi.fn(() => Effect.succeed(undefined as void)),
    addDiffComment: vi.fn(() => Effect.succeed(undefined as void)),
    getReviewThreads: vi.fn(() => Effect.succeed([])),
    resolveThread: vi.fn(() => Effect.succeed(undefined as void)),
    unresolveThread: vi.fn(() => Effect.succeed(undefined as void)),
    replyToComment: vi.fn(() => Effect.succeed(undefined as void)),
    requestReReview: vi.fn(() => Effect.succeed(undefined as void)),
    mergePR: vi.fn(() => Effect.succeed(undefined as void)),
    deleteReviewComment: vi.fn(() => Effect.succeed(undefined as void)),
    createPendingReview: vi.fn(() => Effect.succeed({ id: 42 })),
    addPendingReviewComment: vi.fn(() => Effect.succeed(undefined as void)),
    submitPendingReview: vi.fn(() => Effect.succeed(undefined as void)),
    discardPendingReview: vi.fn(() => Effect.succeed(undefined as void)),
    closePR: vi.fn(() => Effect.succeed(undefined as void)),
    reopenPR: vi.fn(() => Effect.succeed(undefined as void)),
    editIssueComment: vi.fn(() => Effect.succeed(undefined as void)),
    editReviewComment: vi.fn(() => Effect.succeed(undefined as void)),
    updatePRBody: vi.fn(() => Effect.succeed(undefined as void)),
    updatePRTitle: vi.fn(() => Effect.succeed(undefined as void)),
    getCommitDiff: vi.fn(() => Effect.succeed([])),
    convertToDraft: vi.fn(() => Effect.succeed(undefined as void)),
    markReadyForReview: vi.fn(() => Effect.succeed(undefined as void)),
    getLabels: vi.fn(() => Effect.succeed([])),
    setLabels: vi.fn(() => Effect.succeed(undefined as void)),
    createPR: vi.fn(() => Effect.succeed({ number: 1, html_url: 'https://github.com/test/test/pull/1' })),
    getCollaborators: vi.fn(() => Effect.succeed([])),
    updateAssignees: vi.fn(() => Effect.succeed(undefined as void)),
    getCurrentUser: vi.fn(() => Effect.succeed({ login: 'testuser' })),
    ...overrides,
  }
}

const TEST_CONFIG: ProviderConfig = {
  type: 'github',
  baseUrl: 'https://api.github.com',
  token: 'ghp_test123',
  owner: 'myorg',
  repo: 'myrepo',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createGitHubProvider', () => {
  it('returns a provider with type github', () => {
    const provider = createGitHubProvider(TEST_CONFIG, makeMockService())
    expect(provider.type).toBe('github')
  })

  it('exposes correct capabilities', () => {
    const provider = createGitHubProvider(TEST_CONFIG, makeMockService())
    expect(provider.capabilities.supportsDraftPR).toBe(true)
    expect(provider.capabilities.supportsReviewThreads).toBe(true)
    expect(provider.capabilities.supportsGraphQL).toBe(true)
    expect(provider.capabilities.supportsReactions).toBe(true)
    expect(provider.capabilities.supportsCheckRuns).toBe(true)
    expect(provider.capabilities.supportsMergeStrategies).toEqual(['merge', 'squash', 'rebase'])
  })

  describe('PR reads', () => {
    it('listPRs delegates to service.listPRs with owner/repo', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      const exit = await Effect.runPromiseExit(provider.listPRs({ state: 'open', perPage: 25 }))
      expect(Exit.isSuccess(exit)).toBe(true)
      expect(service.listPRs).toHaveBeenCalledWith('myorg', 'myrepo', {
        state: 'open',
        sort: undefined,
        direction: undefined,
        perPage: 25,
        page: undefined,
      })
    })

    it('listPRs wraps items in PRListResult', async () => {
      const mockPR = { number: 1 } as never
      const service = makeMockService({
        listPRs: vi.fn(() => Effect.succeed([mockPR])),
      })
      const provider = createGitHubProvider(TEST_CONFIG, service)
      const result = await Effect.runPromise(provider.listPRs({}))
      expect(result.items).toEqual([mockPR])
    })

    it('getPR delegates with owner/repo', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      await Effect.runPromise(provider.getPR(42))
      expect(service.getPR).toHaveBeenCalledWith('myorg', 'myrepo', 42)
    })

    it('getPRFiles delegates with owner/repo', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      await Effect.runPromise(provider.getPRFiles(7))
      expect(service.getPRFiles).toHaveBeenCalledWith('myorg', 'myrepo', 7)
    })

    it('getPRComments delegates with owner/repo', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      await Effect.runPromise(provider.getPRComments(3))
      expect(service.getPRComments).toHaveBeenCalledWith('myorg', 'myrepo', 3)
    })

    it('getIssueComments delegates with owner/repo', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      await Effect.runPromise(provider.getIssueComments(5))
      expect(service.getIssueComments).toHaveBeenCalledWith('myorg', 'myrepo', 5)
    })

    it('getPRReviews delegates with owner/repo', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      await Effect.runPromise(provider.getPRReviews(10))
      expect(service.getPRReviews).toHaveBeenCalledWith('myorg', 'myrepo', 10)
    })

    it('getPRCommits delegates with owner/repo', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      await Effect.runPromise(provider.getPRCommits(11))
      expect(service.getPRCommits).toHaveBeenCalledWith('myorg', 'myrepo', 11)
    })

    it('getPRChecks delegates with owner/repo and ref', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      await Effect.runPromise(provider.getPRChecks('abc123'))
      expect(service.getPRChecks).toHaveBeenCalledWith('myorg', 'myrepo', 'abc123')
    })

    it('getReviewThreads delegates with owner/repo', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      await Effect.runPromise(provider.getReviewThreads(15))
      expect(service.getReviewThreads).toHaveBeenCalledWith('myorg', 'myrepo', 15)
    })

    it('getCommitDiff delegates with owner/repo', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      await Effect.runPromise(provider.getCommitDiff('sha123'))
      expect(service.getCommitDiff).toHaveBeenCalledWith('myorg', 'myrepo', 'sha123')
    })
  })

  describe('user-scoped queries', () => {
    it('getMyPRs delegates state filter', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      await Effect.runPromise(provider.getMyPRs('closed'))
      expect(service.getMyPRs).toHaveBeenCalledWith('closed')
    })

    it('getReviewRequests delegates state filter', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      await Effect.runPromise(provider.getReviewRequests('open'))
      expect(service.getReviewRequests).toHaveBeenCalledWith('open')
    })

    it('getInvolvedPRs delegates state filter', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      await Effect.runPromise(provider.getInvolvedPRs('all'))
      expect(service.getInvolvedPRs).toHaveBeenCalledWith('all')
    })
  })

  describe('review mutations', () => {
    it('submitReview delegates with owner/repo', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      await Effect.runPromise(provider.submitReview(1, 'LGTM', 'APPROVE'))
      expect(service.submitReview).toHaveBeenCalledWith('myorg', 'myrepo', 1, 'LGTM', 'APPROVE')
    })

    it('createPendingReview delegates and returns id', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      const result = await Effect.runPromise(provider.createPendingReview(5))
      expect(result.id).toBe(42)
      expect(service.createPendingReview).toHaveBeenCalledWith('myorg', 'myrepo', 5)
    })

    it('addPendingReviewComment delegates with all params', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      await Effect.runPromise(
        provider.addPendingReviewComment({
          prNumber: 3,
          reviewId: 42,
          body: 'needs fix',
          path: 'src/foo.ts',
          line: 10,
          side: 'RIGHT',
          startLine: 8,
          startSide: 'RIGHT',
        }),
      )
      expect(service.addPendingReviewComment).toHaveBeenCalledWith(
        'myorg', 'myrepo', 3, 42, 'needs fix', 'src/foo.ts', 10, 'RIGHT', 8, 'RIGHT',
      )
    })

    it('submitPendingReview delegates with all params', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      await Effect.runPromise(provider.submitPendingReview(3, 42, 'done', 'COMMENT'))
      expect(service.submitPendingReview).toHaveBeenCalledWith('myorg', 'myrepo', 3, 42, 'done', 'COMMENT')
    })

    it('discardPendingReview delegates with owner/repo', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      await Effect.runPromise(provider.discardPendingReview(3, 42))
      expect(service.discardPendingReview).toHaveBeenCalledWith('myorg', 'myrepo', 3, 42)
    })
  })

  describe('comment mutations', () => {
    it('addComment delegates with owner/repo', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      await Effect.runPromise(provider.addComment(1, 'hello'))
      expect(service.addComment).toHaveBeenCalledWith('myorg', 'myrepo', 1, 'hello')
    })

    it('addDiffComment delegates with all params', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      await Effect.runPromise(
        provider.addDiffComment({
          prNumber: 2,
          body: 'nit',
          commitId: 'abc',
          path: 'src/bar.ts',
          line: 5,
          side: 'LEFT',
        }),
      )
      expect(service.addDiffComment).toHaveBeenCalledWith(
        'myorg', 'myrepo', 2, 'nit', 'abc', 'src/bar.ts', 5, 'LEFT', undefined, undefined,
      )
    })

    it('replyToComment delegates with owner/repo', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      await Effect.runPromise(provider.replyToComment(1, 99, 'thanks'))
      expect(service.replyToComment).toHaveBeenCalledWith('myorg', 'myrepo', 1, 'thanks', 99)
    })

    it('editIssueComment delegates with owner/repo', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      await Effect.runPromise(provider.editIssueComment(55, 'updated'))
      expect(service.editIssueComment).toHaveBeenCalledWith('myorg', 'myrepo', 55, 'updated')
    })

    it('editReviewComment delegates with owner/repo', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      await Effect.runPromise(provider.editReviewComment(66, 'fixed'))
      expect(service.editReviewComment).toHaveBeenCalledWith('myorg', 'myrepo', 66, 'fixed')
    })

    it('deleteReviewComment delegates with owner/repo', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      await Effect.runPromise(provider.deleteReviewComment(77))
      expect(service.deleteReviewComment).toHaveBeenCalledWith('myorg', 'myrepo', 77)
    })
  })

  describe('PR state mutations', () => {
    it('mergePR delegates with owner/repo and method', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      await Effect.runPromise(provider.mergePR(1, 'squash', 'my title', 'my message'))
      expect(service.mergePR).toHaveBeenCalledWith(
        'myorg', 'myrepo', 1, 'squash', 'my title', 'my message',
      )
    })

    it('closePR delegates with owner/repo', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      await Effect.runPromise(provider.closePR(1))
      expect(service.closePR).toHaveBeenCalledWith('myorg', 'myrepo', 1)
    })

    it('reopenPR delegates with owner/repo', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      await Effect.runPromise(provider.reopenPR(1))
      expect(service.reopenPR).toHaveBeenCalledWith('myorg', 'myrepo', 1)
    })

    it('updatePRTitle delegates with owner/repo', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      await Effect.runPromise(provider.updatePRTitle(1, 'new title'))
      expect(service.updatePRTitle).toHaveBeenCalledWith('myorg', 'myrepo', 1, 'new title')
    })

    it('updatePRBody delegates with owner/repo', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      await Effect.runPromise(provider.updatePRBody(1, 'new body'))
      expect(service.updatePRBody).toHaveBeenCalledWith('myorg', 'myrepo', 1, 'new body')
    })

    it('requestReReview delegates with owner/repo', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      await Effect.runPromise(provider.requestReReview(1, ['alice', 'bob']))
      expect(service.requestReReview).toHaveBeenCalledWith('myorg', 'myrepo', 1, ['alice', 'bob'])
    })
  })

  describe('thread operations', () => {
    it('resolveThread delegates threadId', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      await Effect.runPromise(provider.resolveThread('thread-id-1'))
      expect(service.resolveThread).toHaveBeenCalledWith('thread-id-1')
    })

    it('unresolveThread delegates threadId', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      await Effect.runPromise(provider.unresolveThread('thread-id-2'))
      expect(service.unresolveThread).toHaveBeenCalledWith('thread-id-2')
    })
  })

  describe('draft operations', () => {
    it('convertToDraft delegates node ID', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      await Effect.runPromise(provider.convertToDraft('PR_node123'))
      expect(service.convertToDraft).toHaveBeenCalledWith('PR_node123')
    })

    it('markReadyForReview delegates node ID', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      await Effect.runPromise(provider.markReadyForReview('PR_node456'))
      expect(service.markReadyForReview).toHaveBeenCalledWith('PR_node456')
    })
  })

  describe('user info', () => {
    it('getCurrentUser delegates to service', async () => {
      const service = makeMockService()
      const provider = createGitHubProvider(TEST_CONFIG, service)
      const result = await Effect.runPromise(provider.getCurrentUser())
      expect(result.login).toBe('testuser')
    })
  })
})

describe('createUnsupportedProvider', () => {
  it('returns a provider with the given type', () => {
    const provider = createUnsupportedProvider('gitlab')
    expect(provider.type).toBe('gitlab')
  })

  it('has all capabilities disabled', () => {
    const provider = createUnsupportedProvider('bitbucket')
    expect(provider.capabilities.supportsDraftPR).toBe(false)
    expect(provider.capabilities.supportsReviewThreads).toBe(false)
    expect(provider.capabilities.supportsGraphQL).toBe(false)
    expect(provider.capabilities.supportsReactions).toBe(false)
    expect(provider.capabilities.supportsCheckRuns).toBe(false)
    expect(provider.capabilities.supportsMergeStrategies).toEqual([])
  })

  it('fails all operations with descriptive error', async () => {
    const provider = createUnsupportedProvider('azure')
    const exit = await Effect.runPromiseExit(provider.listPRs({}))
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const error = exit.cause
      // Extract the error from the cause
      const errorStr = String(error)
      expect(errorStr).toContain('azure')
      expect(errorStr).toContain('not yet supported')
    }
  })

  it('fails getCurrentUser with descriptive error', async () => {
    const provider = createUnsupportedProvider('gitea')
    const exit = await Effect.runPromiseExit(provider.getCurrentUser())
    expect(Exit.isFailure(exit)).toBe(true)
  })

  it('fails getPR with descriptive error', async () => {
    const provider = createUnsupportedProvider('gitlab')
    const exit = await Effect.runPromiseExit(provider.getPR(1))
    expect(Exit.isFailure(exit)).toBe(true)
  })

  it('fails mergePR with descriptive error', async () => {
    const provider = createUnsupportedProvider('bitbucket')
    const exit = await Effect.runPromiseExit(provider.mergePR(1, 'merge'))
    expect(Exit.isFailure(exit)).toBe(true)
  })
})

describe('createProvider factory', () => {
  it('creates a GitHub provider for type github', () => {
    const service = makeMockService()
    const provider = createProvider(TEST_CONFIG, service)
    expect(provider.type).toBe('github')
    expect(provider.capabilities.supportsGraphQL).toBe(true)
  })

  it('creates a GitLab provider for gitlab type', () => {
    const service = makeMockService()
    const provider = createProvider(
      { ...TEST_CONFIG, type: 'gitlab' },
      service,
    )
    expect(provider.type).toBe('gitlab')
    expect(provider.capabilities.supportsCheckRuns).toBe(true)
    expect(provider.capabilities.supportsDraftPR).toBe(true)
  })

  it('creates an unsupported provider for bitbucket', () => {
    const service = makeMockService()
    const provider = createProvider(
      { ...TEST_CONFIG, type: 'bitbucket' },
      service,
    )
    expect(provider.type).toBe('bitbucket')
  })

  it('creates an unsupported provider for azure', () => {
    const service = makeMockService()
    const provider = createProvider(
      { ...TEST_CONFIG, type: 'azure' },
      service,
    )
    expect(provider.type).toBe('azure')
  })

  it('creates an unsupported provider for gitea', () => {
    const service = makeMockService()
    const provider = createProvider(
      { ...TEST_CONFIG, type: 'gitea' },
      service,
    )
    expect(provider.type).toBe('gitea')
  })

  it('github provider delegates to service correctly', async () => {
    const service = makeMockService()
    const provider = createProvider(TEST_CONFIG, service)
    await Effect.runPromise(provider.getPR(99))
    expect(service.getPR).toHaveBeenCalledWith('myorg', 'myrepo', 99)
  })
})
