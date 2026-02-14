import type { Effect } from 'effect'
import type { PullRequest } from '../../models/pull-request'
import type { Comment } from '../../models/comment'
import type { IssueComment } from '../../models/issue-comment'
import type { Review } from '../../models/review'
import type { FileChange } from '../../models/file-change'
import type { Commit } from '../../models/commit'
import type { CheckRunsResponse } from '../../models/check'
import type { RepoLabel } from '../../models/label'
import type { User } from '../../models/user'
import type { ReactionType } from '../../models/reaction'
import type { TimelineEvent } from '../../models/timeline-event'
import type { SuggestionParams, AcceptSuggestionParams } from '../../models/suggestion'
import type { ApiError, ReviewThread } from '../CodeReviewApiTypes'

// ---------------------------------------------------------------------------
// Provider type discriminant
// ---------------------------------------------------------------------------

export type ProviderType = 'github' | 'gitlab' | 'bitbucket' | 'azure' | 'gitea'

// ---------------------------------------------------------------------------
// Provider configuration
// ---------------------------------------------------------------------------

export interface ProviderConfig {
  readonly type: ProviderType
  readonly baseUrl: string
  readonly token: string
  readonly owner: string
  readonly repo: string
}

// ---------------------------------------------------------------------------
// Provider capability flags
// ---------------------------------------------------------------------------

export interface ProviderCapabilities {
  readonly supportsDraftPR: boolean
  readonly supportsReviewThreads: boolean
  readonly supportsGraphQL: boolean
  readonly supportsReactions: boolean
  readonly supportsCheckRuns: boolean
  readonly supportsLabels: boolean
  readonly supportsAssignees: boolean
  readonly supportsMergeStrategies: readonly string[]
  // V2 capability flags
  readonly supportsStreaming: boolean
  readonly supportsBatchFetch: boolean
  readonly supportsWebhooks: boolean
  readonly supportsSuggestions: boolean
  readonly supportsTimeline: boolean
}

// ---------------------------------------------------------------------------
// Shared parameter types
// ---------------------------------------------------------------------------

export interface ListPRsParams {
  readonly state?: 'open' | 'closed' | 'all'
  readonly sort?: 'created' | 'updated' | 'popularity' | 'long-running'
  readonly direction?: 'asc' | 'desc'
  readonly perPage?: number
  readonly page?: number
}

export interface PRListResult {
  readonly items: readonly PullRequest[]
  readonly totalCount?: number
}

export interface AddDiffCommentParams {
  readonly prNumber: number
  readonly body: string
  readonly commitId: string
  readonly path: string
  readonly line: number
  readonly side: 'LEFT' | 'RIGHT'
  readonly startLine?: number
  readonly startSide?: 'LEFT' | 'RIGHT'
}

export interface AddPendingReviewCommentParams {
  readonly prNumber: number
  readonly reviewId: number
  readonly body: string
  readonly path: string
  readonly line: number
  readonly side: 'LEFT' | 'RIGHT'
  readonly startLine?: number
  readonly startSide?: 'LEFT' | 'RIGHT'
}

export interface CreatePRParams {
  readonly title: string
  readonly body: string
  readonly baseBranch: string
  readonly headBranch: string
  readonly draft?: boolean
}

export interface CreatePRResult {
  readonly number: number
  readonly html_url: string
}

export interface PRFilesPage {
  readonly items: readonly FileChange[]
  readonly hasNextPage: boolean
  readonly totalCount?: number
}

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

export interface Provider {
  readonly type: ProviderType
  readonly capabilities: ProviderCapabilities

  // PR read operations
  readonly listPRs: (params: ListPRsParams) => Effect.Effect<PRListResult, ApiError>
  readonly getPR: (number: number) => Effect.Effect<PullRequest, ApiError>
  readonly getPRFiles: (number: number) => Effect.Effect<readonly FileChange[], ApiError>
  readonly getPRFilesPage: (number: number, page: number) => Effect.Effect<PRFilesPage, ApiError>
  readonly getFileDiff: (number: number, filename: string) => Effect.Effect<FileChange | null, ApiError>
  readonly getPRComments: (number: number) => Effect.Effect<readonly Comment[], ApiError>
  readonly getIssueComments: (issueNumber: number) => Effect.Effect<readonly IssueComment[], ApiError>
  readonly getPRReviews: (number: number) => Effect.Effect<readonly Review[], ApiError>
  readonly getPRCommits: (number: number) => Effect.Effect<readonly Commit[], ApiError>
  readonly getPRChecks: (ref: string) => Effect.Effect<CheckRunsResponse, ApiError>
  readonly getReviewThreads: (prNumber: number) => Effect.Effect<readonly ReviewThread[], ApiError>
  readonly getCommitDiff: (sha: string) => Effect.Effect<readonly FileChange[], ApiError>

  // User-scoped PR queries
  readonly getMyPRs: (stateFilter?: 'open' | 'closed' | 'all') => Effect.Effect<readonly PullRequest[], ApiError>
  readonly getReviewRequests: (stateFilter?: 'open' | 'closed' | 'all') => Effect.Effect<readonly PullRequest[], ApiError>
  readonly getInvolvedPRs: (stateFilter?: 'open' | 'closed' | 'all') => Effect.Effect<readonly PullRequest[], ApiError>

  // Review mutations
  readonly submitReview: (
    prNumber: number,
    body: string,
    event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
  ) => Effect.Effect<void, ApiError>
  readonly createPendingReview: (prNumber: number) => Effect.Effect<{ readonly id: number }, ApiError>
  readonly addPendingReviewComment: (params: AddPendingReviewCommentParams) => Effect.Effect<void, ApiError>
  readonly submitPendingReview: (
    prNumber: number,
    reviewId: number,
    body: string,
    event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
  ) => Effect.Effect<void, ApiError>
  readonly discardPendingReview: (prNumber: number, reviewId: number) => Effect.Effect<void, ApiError>

  // Comment mutations
  readonly addComment: (issueNumber: number, body: string) => Effect.Effect<void, ApiError>
  readonly addDiffComment: (params: AddDiffCommentParams) => Effect.Effect<void, ApiError>
  readonly replyToComment: (prNumber: number, commentId: number, body: string) => Effect.Effect<void, ApiError>
  readonly editIssueComment: (commentId: number, body: string) => Effect.Effect<void, ApiError>
  readonly editReviewComment: (commentId: number, body: string) => Effect.Effect<void, ApiError>
  readonly deleteReviewComment: (commentId: number) => Effect.Effect<void, ApiError>

  // PR state mutations
  readonly mergePR: (
    prNumber: number,
    method: 'merge' | 'squash' | 'rebase',
    commitTitle?: string,
    commitMessage?: string,
  ) => Effect.Effect<void, ApiError>
  readonly closePR: (prNumber: number) => Effect.Effect<void, ApiError>
  readonly reopenPR: (prNumber: number) => Effect.Effect<void, ApiError>
  readonly updatePRTitle: (prNumber: number, title: string) => Effect.Effect<void, ApiError>
  readonly updatePRBody: (prNumber: number, body: string) => Effect.Effect<void, ApiError>
  readonly requestReReview: (prNumber: number, reviewers: readonly string[]) => Effect.Effect<void, ApiError>

  // Thread operations (requires supportsReviewThreads capability)
  readonly resolveThread: (threadId: string) => Effect.Effect<void, ApiError>
  readonly unresolveThread: (threadId: string) => Effect.Effect<void, ApiError>

  // Draft operations (requires supportsDraftPR capability)
  readonly convertToDraft: (prNodeId: string) => Effect.Effect<void, ApiError>
  readonly markReadyForReview: (prNodeId: string) => Effect.Effect<void, ApiError>

  // Label operations (requires supportsLabels capability)
  readonly getLabels: () => Effect.Effect<readonly RepoLabel[], ApiError>
  readonly setLabels: (prNumber: number, labels: readonly string[]) => Effect.Effect<void, ApiError>

  // Assignee operations (requires supportsAssignees capability)
  readonly getCollaborators: () => Effect.Effect<readonly User[], ApiError>
  readonly updateAssignees: (prNumber: number, assignees: readonly string[]) => Effect.Effect<void, ApiError>

  // Reaction operations (requires supportsReactions capability)
  readonly addReaction: (
    commentId: number,
    reaction: ReactionType,
    commentType: 'issue_comment' | 'review_comment',
  ) => Effect.Effect<void, ApiError>

  // PR creation
  readonly createPR: (params: CreatePRParams) => Effect.Effect<CreatePRResult, ApiError>

  // User info
  readonly getCurrentUser: () => Effect.Effect<{ readonly login: string }, ApiError>

  // V2 optional methods — providers may implement these for enhanced functionality.
  // The ProviderV1Adapter supplies default implementations for any that are missing.

  /** Batch fetch PR metadata for multiple PRs */
  readonly batchGetPRs?: (
    prNumbers: readonly number[],
  ) => Effect.Effect<readonly PullRequest[], ApiError>

  /** Stream diff for a single file (for large files) */
  readonly streamFileDiff?: (
    prNumber: number,
    filePath: string,
  ) => AsyncIterable<string>

  /** Get unified timeline events */
  readonly getTimeline?: (
    prNumber: number,
  ) => Effect.Effect<readonly TimelineEvent[], ApiError>

  /** Submit a code suggestion comment */
  readonly submitSuggestion?: (
    params: SuggestionParams,
  ) => Effect.Effect<Comment, ApiError>

  /** Accept a code suggestion (creates a commit) */
  readonly acceptSuggestion?: (
    params: AcceptSuggestionParams,
  ) => Effect.Effect<void, ApiError>
}

// ---------------------------------------------------------------------------
// Default base URLs for each provider type
// ---------------------------------------------------------------------------

export function getDefaultBaseUrl(type: ProviderType): string {
  switch (type) {
    case 'github':
      return 'https://api.github.com'
    case 'gitlab':
      return 'https://gitlab.com/api/v4'
    case 'bitbucket':
      return 'https://api.bitbucket.org/2.0'
    case 'azure':
      return 'https://dev.azure.com'
    case 'gitea':
      return 'https://gitea.com/api/v1'
  }
}
