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
      listPRs: () => Effect.succeed([]),
      getPR: () => Effect.succeed({} as never),
      getPRFiles: () => Effect.succeed([]),
      getPRComments: () => Effect.succeed([]),
      getIssueComments: () => Effect.succeed([]),
      getPRReviews: () => Effect.succeed([]),
      getPRCommits: () => Effect.succeed([]),
      getMyPRs: () => Effect.succeed([]),
      getReviewRequests: () => Effect.succeed([]),
      getInvolvedPRs: () => Effect.succeed([]),
      getPRChecks: () => Effect.succeed({} as never),
      submitReview: () => Effect.succeed(undefined as void),
      addComment: () => Effect.succeed(undefined as void),
      addDiffComment: () => Effect.succeed(undefined as void),
      getReviewThreads: () => Effect.succeed([]),
      resolveThread: () => Effect.succeed(undefined as void),
      unresolveThread: () => Effect.succeed(undefined as void),
      replyToComment: () => Effect.succeed(undefined as void),
      requestReReview: () => Effect.succeed(undefined as void),
      mergePR: () => Effect.succeed(undefined as void),
      deleteReviewComment: () => Effect.succeed(undefined as void),
      createPendingReview: () => Effect.succeed({ id: 1 }),
      addPendingReviewComment: () => Effect.succeed(undefined as void),
      submitPendingReview: () => Effect.succeed(undefined as void),
      discardPendingReview: () => Effect.succeed(undefined as void),
      closePR: () => Effect.succeed(undefined as void),
      reopenPR: () => Effect.succeed(undefined as void),
      editIssueComment: () => Effect.succeed(undefined as void),
      editReviewComment: () => Effect.succeed(undefined as void),
      updatePRBody: () => Effect.succeed(undefined as void),
      updatePRTitle: () => Effect.succeed(undefined as void),
      getCommitDiff: () => Effect.succeed([]),
      convertToDraft: () => Effect.succeed(undefined as void),
      markReadyForReview: () => Effect.succeed(undefined as void),
      getLabels: () => Effect.succeed([]),
      setLabels: () => Effect.succeed(undefined as void),
      createPR: () => Effect.succeed({ number: 1, html_url: 'https://github.com/test/test/pull/1' }),
      getCollaborators: () => Effect.succeed([]),
      updateAssignees: () => Effect.succeed(undefined as void),
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
