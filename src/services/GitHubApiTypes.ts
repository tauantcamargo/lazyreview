import { Context, Effect } from 'effect'
import type { PullRequest } from '../models/pull-request'
import type { Comment } from '../models/comment'
import type { IssueComment } from '../models/issue-comment'
import type { Review } from '../models/review'
import type { FileChange } from '../models/file-change'
import type { Commit } from '../models/commit'
import type { CheckRunsResponse } from '../models/check'
import type { AuthError, GitHubError, NetworkError } from '../models/errors'

export interface ListPRsOptions {
  readonly state?: 'open' | 'closed' | 'all'
  readonly sort?: 'created' | 'updated' | 'popularity' | 'long-running'
  readonly direction?: 'asc' | 'desc'
  readonly perPage?: number
  readonly page?: number
}

export type ApiError = GitHubError | NetworkError | AuthError

export interface ReviewThread {
  readonly id: string
  readonly isResolved: boolean
  readonly comments: readonly { readonly databaseId: number }[]
}

export interface GitHubApiService {
  readonly listPullRequests: (
    owner: string,
    repo: string,
    options?: ListPRsOptions,
  ) => Effect.Effect<readonly PullRequest[], ApiError>

  readonly getPullRequest: (
    owner: string,
    repo: string,
    number: number,
  ) => Effect.Effect<PullRequest, ApiError>

  readonly getPullRequestFiles: (
    owner: string,
    repo: string,
    number: number,
  ) => Effect.Effect<readonly FileChange[], ApiError>

  readonly getPullRequestComments: (
    owner: string,
    repo: string,
    number: number,
  ) => Effect.Effect<readonly Comment[], ApiError>

  readonly getIssueComments: (
    owner: string,
    repo: string,
    issueNumber: number,
  ) => Effect.Effect<readonly IssueComment[], ApiError>

  readonly getPullRequestReviews: (
    owner: string,
    repo: string,
    number: number,
  ) => Effect.Effect<readonly Review[], ApiError>

  readonly getPullRequestCommits: (
    owner: string,
    repo: string,
    number: number,
  ) => Effect.Effect<readonly Commit[], ApiError>

  readonly getMyPRs: (
    stateFilter?: 'open' | 'closed' | 'all',
  ) => Effect.Effect<readonly PullRequest[], ApiError>

  readonly getReviewRequests: (
    stateFilter?: 'open' | 'closed' | 'all',
  ) => Effect.Effect<readonly PullRequest[], ApiError>

  readonly getInvolvedPRs: (
    stateFilter?: 'open' | 'closed' | 'all',
  ) => Effect.Effect<readonly PullRequest[], ApiError>

  readonly getCheckRuns: (
    owner: string,
    repo: string,
    ref: string,
  ) => Effect.Effect<CheckRunsResponse, ApiError>

  readonly submitReview: (
    owner: string,
    repo: string,
    prNumber: number,
    body: string,
    event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
  ) => Effect.Effect<void, ApiError>

  readonly createComment: (
    owner: string,
    repo: string,
    issueNumber: number,
    body: string,
  ) => Effect.Effect<void, ApiError>

  readonly createReviewComment: (
    owner: string,
    repo: string,
    prNumber: number,
    body: string,
    commitId: string,
    path: string,
    line: number,
    side: 'LEFT' | 'RIGHT',
    startLine?: number,
    startSide?: 'LEFT' | 'RIGHT',
  ) => Effect.Effect<void, ApiError>

  readonly getReviewThreads: (
    owner: string,
    repo: string,
    prNumber: number,
  ) => Effect.Effect<readonly ReviewThread[], ApiError>

  readonly resolveReviewThread: (
    threadId: string,
  ) => Effect.Effect<void, ApiError>

  readonly unresolveReviewThread: (
    threadId: string,
  ) => Effect.Effect<void, ApiError>

  readonly replyToReviewComment: (
    owner: string,
    repo: string,
    prNumber: number,
    body: string,
    inReplyTo: number,
  ) => Effect.Effect<void, ApiError>

  readonly requestReReview: (
    owner: string,
    repo: string,
    prNumber: number,
    reviewers: readonly string[],
  ) => Effect.Effect<void, ApiError>

  readonly mergePullRequest: (
    owner: string,
    repo: string,
    prNumber: number,
    mergeMethod: 'merge' | 'squash' | 'rebase',
    commitTitle?: string,
    commitMessage?: string,
  ) => Effect.Effect<void, ApiError>

  readonly deleteReviewComment: (
    owner: string,
    repo: string,
    commentId: number,
  ) => Effect.Effect<void, ApiError>

  readonly createPendingReview: (
    owner: string,
    repo: string,
    prNumber: number,
  ) => Effect.Effect<{ readonly id: number }, ApiError>

  readonly addPendingReviewComment: (
    owner: string,
    repo: string,
    prNumber: number,
    reviewId: number,
    body: string,
    path: string,
    line: number,
    side: 'LEFT' | 'RIGHT',
    startLine?: number,
    startSide?: 'LEFT' | 'RIGHT',
  ) => Effect.Effect<void, ApiError>

  readonly submitPendingReview: (
    owner: string,
    repo: string,
    prNumber: number,
    reviewId: number,
    body: string,
    event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
  ) => Effect.Effect<void, ApiError>

  readonly discardPendingReview: (
    owner: string,
    repo: string,
    prNumber: number,
    reviewId: number,
  ) => Effect.Effect<void, ApiError>

  readonly closePullRequest: (
    owner: string,
    repo: string,
    prNumber: number,
  ) => Effect.Effect<void, ApiError>

  readonly reopenPullRequest: (
    owner: string,
    repo: string,
    prNumber: number,
  ) => Effect.Effect<void, ApiError>

  readonly editIssueComment: (
    owner: string,
    repo: string,
    commentId: number,
    body: string,
  ) => Effect.Effect<void, ApiError>

  readonly editReviewComment: (
    owner: string,
    repo: string,
    commentId: number,
    body: string,
  ) => Effect.Effect<void, ApiError>

  readonly getCurrentUser: () => Effect.Effect<{ readonly login: string }, ApiError>
}

export class GitHubApi extends Context.Tag('GitHubApi')<
  GitHubApi,
  GitHubApiService
>() {}
