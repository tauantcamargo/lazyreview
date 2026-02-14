import { Context, Effect } from 'effect'
import type { PullRequest } from '../models/pull-request'
import type { Comment } from '../models/comment'
import type { IssueComment } from '../models/issue-comment'
import type { Review } from '../models/review'
import type { FileChange } from '../models/file-change'
import type { Commit } from '../models/commit'
import type { CheckRunsResponse } from '../models/check'
import type { RepoLabel } from '../models/label'
import type { User } from '../models/user'
import type { ReactionType } from '../models/reaction'
import type { TimelineEvent } from '../models/timeline-event'
import type { SuggestionParams, AcceptSuggestionParams } from '../models/suggestion'
import type { PRFilesPage } from './providers/types'
import type {
  AuthError,
  AzureError,
  BitbucketError,
  GiteaError,
  GitHubError,
  GitLabError,
  NetworkError,
} from '../models/errors'

export interface ListPRsOptions {
  readonly state?: 'open' | 'closed' | 'all'
  readonly sort?: 'created' | 'updated' | 'popularity' | 'long-running'
  readonly direction?: 'asc' | 'desc'
  readonly perPage?: number
  readonly page?: number
}

export type ApiError =
  | GitHubError
  | GitLabError
  | BitbucketError
  | AzureError
  | GiteaError
  | NetworkError
  | AuthError

export interface ReviewThread {
  readonly id: string
  readonly isResolved: boolean
  readonly comments: readonly { readonly databaseId: number }[]
}

// ---------------------------------------------------------------------------
// CodeReviewApiService -- the Effect service interface
//
// Method names are aligned 1:1 with the Provider interface
// (src/services/providers/types.ts). The only difference is that these
// methods receive owner/repo as explicit params because the Effect service
// has no baked-in ProviderConfig.
// ---------------------------------------------------------------------------

export interface CodeReviewApiService {
  // -- PR read operations (aligned with Provider) ---------------------------

  readonly listPRs: (
    owner: string,
    repo: string,
    options?: ListPRsOptions,
  ) => Effect.Effect<readonly PullRequest[], ApiError>

  readonly getPR: (
    owner: string,
    repo: string,
    number: number,
  ) => Effect.Effect<PullRequest, ApiError>

  readonly getPRFiles: (
    owner: string,
    repo: string,
    number: number,
  ) => Effect.Effect<readonly FileChange[], ApiError>

  readonly getPRFilesPage: (
    owner: string,
    repo: string,
    number: number,
    page: number,
  ) => Effect.Effect<PRFilesPage, ApiError>

  readonly getFileDiff: (
    owner: string,
    repo: string,
    number: number,
    filename: string,
  ) => Effect.Effect<FileChange | null, ApiError>

  readonly getPRComments: (
    owner: string,
    repo: string,
    number: number,
  ) => Effect.Effect<readonly Comment[], ApiError>

  readonly getIssueComments: (
    owner: string,
    repo: string,
    issueNumber: number,
  ) => Effect.Effect<readonly IssueComment[], ApiError>

  readonly getPRReviews: (
    owner: string,
    repo: string,
    number: number,
  ) => Effect.Effect<readonly Review[], ApiError>

  readonly getPRCommits: (
    owner: string,
    repo: string,
    number: number,
  ) => Effect.Effect<readonly Commit[], ApiError>

  readonly getPRChecks: (
    owner: string,
    repo: string,
    ref: string,
  ) => Effect.Effect<CheckRunsResponse, ApiError>

  readonly getReviewThreads: (
    owner: string,
    repo: string,
    prNumber: number,
  ) => Effect.Effect<readonly ReviewThread[], ApiError>

  readonly getCommitDiff: (
    owner: string,
    repo: string,
    sha: string,
  ) => Effect.Effect<readonly FileChange[], ApiError>

  // -- User-scoped PR queries -----------------------------------------------

  readonly getMyPRs: (
    stateFilter?: 'open' | 'closed' | 'all',
  ) => Effect.Effect<readonly PullRequest[], ApiError>

  readonly getReviewRequests: (
    stateFilter?: 'open' | 'closed' | 'all',
  ) => Effect.Effect<readonly PullRequest[], ApiError>

  readonly getInvolvedPRs: (
    stateFilter?: 'open' | 'closed' | 'all',
  ) => Effect.Effect<readonly PullRequest[], ApiError>

  // -- Review mutations -----------------------------------------------------

  readonly submitReview: (
    owner: string,
    repo: string,
    prNumber: number,
    body: string,
    event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
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

  // -- Comment mutations ----------------------------------------------------

  readonly addComment: (
    owner: string,
    repo: string,
    issueNumber: number,
    body: string,
  ) => Effect.Effect<void, ApiError>

  readonly addDiffComment: (
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

  readonly replyToComment: (
    owner: string,
    repo: string,
    prNumber: number,
    body: string,
    inReplyTo: number,
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

  readonly deleteReviewComment: (
    owner: string,
    repo: string,
    commentId: number,
  ) => Effect.Effect<void, ApiError>

  // -- PR state mutations ---------------------------------------------------

  readonly mergePR: (
    owner: string,
    repo: string,
    prNumber: number,
    mergeMethod: 'merge' | 'squash' | 'rebase',
    commitTitle?: string,
    commitMessage?: string,
  ) => Effect.Effect<void, ApiError>

  readonly closePR: (
    owner: string,
    repo: string,
    prNumber: number,
  ) => Effect.Effect<void, ApiError>

  readonly reopenPR: (
    owner: string,
    repo: string,
    prNumber: number,
  ) => Effect.Effect<void, ApiError>

  readonly updatePRTitle: (
    owner: string,
    repo: string,
    prNumber: number,
    title: string,
  ) => Effect.Effect<void, ApiError>

  readonly updatePRBody: (
    owner: string,
    repo: string,
    prNumber: number,
    body: string,
  ) => Effect.Effect<void, ApiError>

  readonly requestReReview: (
    owner: string,
    repo: string,
    prNumber: number,
    reviewers: readonly string[],
  ) => Effect.Effect<void, ApiError>

  // -- Thread operations ----------------------------------------------------

  readonly resolveThread: (threadId: string) => Effect.Effect<void, ApiError>

  readonly unresolveThread: (threadId: string) => Effect.Effect<void, ApiError>

  // -- Draft operations -----------------------------------------------------

  readonly convertToDraft: (nodeId: string) => Effect.Effect<void, ApiError>

  readonly markReadyForReview: (nodeId: string) => Effect.Effect<void, ApiError>

  // -- Label operations -----------------------------------------------------

  readonly getLabels: (
    owner: string,
    repo: string,
  ) => Effect.Effect<readonly RepoLabel[], ApiError>

  readonly setLabels: (
    owner: string,
    repo: string,
    prNumber: number,
    labels: readonly string[],
  ) => Effect.Effect<void, ApiError>

  // -- PR creation ----------------------------------------------------------

  readonly createPR: (
    owner: string,
    repo: string,
    title: string,
    body: string,
    baseBranch: string,
    headBranch: string,
    draft?: boolean,
  ) => Effect.Effect<{ readonly number: number; readonly html_url: string }, ApiError>

  // -- Assignee operations --------------------------------------------------

  readonly getCollaborators: (
    owner: string,
    repo: string,
  ) => Effect.Effect<readonly User[], ApiError>

  readonly updateAssignees: (
    owner: string,
    repo: string,
    prNumber: number,
    assignees: readonly string[],
  ) => Effect.Effect<void, ApiError>

  // -- Reaction operations --------------------------------------------------

  readonly addReaction: (
    owner: string,
    repo: string,
    commentId: number,
    reaction: ReactionType,
    commentType: 'issue_comment' | 'review_comment',
  ) => Effect.Effect<void, ApiError>

  // -- User info ------------------------------------------------------------

  readonly getCurrentUser: () => Effect.Effect<{ readonly login: string }, ApiError>

  // -- V2 optional methods (providers may or may not implement these) -------

  /** Batch fetch PR metadata for multiple PRs */
  readonly batchGetPRs?: (
    owner: string,
    repo: string,
    prNumbers: readonly number[],
  ) => Effect.Effect<readonly PullRequest[], ApiError>

  /** Stream diff for a single file (for large files) */
  readonly streamFileDiff?: (
    owner: string,
    repo: string,
    prNumber: number,
    filePath: string,
  ) => AsyncIterable<string>

  /** Get unified timeline events */
  readonly getTimeline?: (
    owner: string,
    repo: string,
    prNumber: number,
  ) => Effect.Effect<readonly TimelineEvent[], ApiError>

  /** Submit a code suggestion comment */
  readonly submitSuggestion?: (
    owner: string,
    repo: string,
    params: SuggestionParams,
  ) => Effect.Effect<Comment, ApiError>

  /** Accept a code suggestion (creates a commit) */
  readonly acceptSuggestion?: (
    owner: string,
    repo: string,
    params: AcceptSuggestionParams,
  ) => Effect.Effect<void, ApiError>

  /** Compare two commits and return changed files */
  readonly getCompareFiles?: (
    owner: string,
    repo: string,
    base: string,
    head: string,
  ) => Effect.Effect<readonly FileChange[], ApiError>
}

export class CodeReviewApi extends Context.Tag('CodeReviewApi')<
  CodeReviewApi,
  CodeReviewApiService
>() {}
