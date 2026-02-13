import { describe, it, expect } from 'vitest'
import { Context, Effect, Layer } from 'effect'
import { CodeReviewApi } from './CodeReviewApiTypes'
import type { CodeReviewApiService } from './CodeReviewApiTypes'
import { GitHubApi } from './GitHubApiTypes'
import type { GitHubApiService } from './GitHubApiTypes'

describe('CodeReviewApi', () => {
  it('is a Context.Tag with identifier CodeReviewApi', () => {
    expect(CodeReviewApi.key).toBe('CodeReviewApi')
  })

  it('can create a layer with succeed', () => {
    const mockService = {
      listPullRequests: () => Effect.succeed([]),
      getPullRequest: () => Effect.succeed({} as never),
      getPullRequestFiles: () => Effect.succeed([]),
      getPullRequestComments: () => Effect.succeed([]),
      getIssueComments: () => Effect.succeed([]),
      getPullRequestReviews: () => Effect.succeed([]),
      getPullRequestCommits: () => Effect.succeed([]),
      getMyPRs: () => Effect.succeed([]),
      getReviewRequests: () => Effect.succeed([]),
      getInvolvedPRs: () => Effect.succeed([]),
      getCheckRuns: () => Effect.succeed({} as never),
      submitReview: () => Effect.succeed(undefined as void),
      createComment: () => Effect.succeed(undefined as void),
      createReviewComment: () => Effect.succeed(undefined as void),
      getReviewThreads: () => Effect.succeed([]),
      resolveReviewThread: () => Effect.succeed(undefined as void),
      unresolveReviewThread: () => Effect.succeed(undefined as void),
      replyToReviewComment: () => Effect.succeed(undefined as void),
      requestReReview: () => Effect.succeed(undefined as void),
      mergePullRequest: () => Effect.succeed(undefined as void),
      deleteReviewComment: () => Effect.succeed(undefined as void),
      createPendingReview: () => Effect.succeed({ id: 1 }),
      addPendingReviewComment: () => Effect.succeed(undefined as void),
      submitPendingReview: () => Effect.succeed(undefined as void),
      discardPendingReview: () => Effect.succeed(undefined as void),
      closePullRequest: () => Effect.succeed(undefined as void),
      reopenPullRequest: () => Effect.succeed(undefined as void),
      editIssueComment: () => Effect.succeed(undefined as void),
      editReviewComment: () => Effect.succeed(undefined as void),
      updatePRDescription: () => Effect.succeed(undefined as void),
      updatePRTitle: () => Effect.succeed(undefined as void),
      getCurrentUser: () => Effect.succeed({ login: 'test' }),
    } satisfies CodeReviewApiService

    const layer = Layer.succeed(CodeReviewApi, mockService)
    expect(layer).toBeDefined()
  })
})

describe('GitHubApiService type compatibility', () => {
  it('GitHubApiService is assignable from CodeReviewApiService', () => {
    // This test validates type compatibility at compile time
    const service: CodeReviewApiService = {} as GitHubApiService
    const reverseService: GitHubApiService = {} as CodeReviewApiService
    expect(service).toBeDefined()
    expect(reverseService).toBeDefined()
  })

  it('GitHubApi tag has different key than CodeReviewApi', () => {
    expect(GitHubApi.key).toBe('GitHubApi')
    expect(CodeReviewApi.key).toBe('CodeReviewApi')
    expect(GitHubApi.key).not.toBe(CodeReviewApi.key)
  })
})
