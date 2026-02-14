import { Effect } from 'effect'
import { z } from 'zod'
import { GiteaError } from '../../models/errors'
import { CheckRunsResponse } from '../../models/check'
import type { ApiError } from '../CodeReviewApiTypes'
import type {
  Provider,
  ProviderConfig,
  ProviderCapabilities,
  ListPRsParams,
  PRListResult,
  AddDiffCommentParams,
} from './types'
import {
  giteaFetchJson,
  giteaFetchAllPages,
} from '../GiteaApiHelpers'
import {
  GiteaPullRequestSchema,
  GiteaReviewCommentSchema,
  GiteaIssueCommentSchema,
  GiteaReviewSchema,
  GiteaChangedFileSchema,
  GiteaCommitSchema,
  mapGiteaPRToPullRequest,
  mapGiteaReviewCommentsToComments,
  mapGiteaIssueCommentsToIssueComments,
  mapGiteaReviewsToReviews,
  mapGiteaChangedFilesToFileChanges,
  mapGiteaCommitsToCommits,
} from '../../models/gitea'
import type {
  GiteaPullRequest,
  GiteaReviewComment,
  GiteaIssueComment,
  GiteaReview,
  GiteaChangedFile,
  GiteaCommit,
} from '../../models/gitea'
import {
  addComment,
  addInlineComment,
  replyToReviewComment,
  editIssueComment,
  deleteIssueComment,
  submitReview,
  mergePR,
  closePR,
  reopenPR,
  updatePRTitle,
  updatePRBody,
  requestReReview,
  getCurrentUser,
} from './gitea-mutations'

// ---------------------------------------------------------------------------
// Gitea capabilities
// ---------------------------------------------------------------------------

const GITEA_CAPABILITIES: ProviderCapabilities = {
  supportsDraftPR: false,
  supportsReviewThreads: false,
  supportsGraphQL: false,
  supportsReactions: true,
  supportsCheckRuns: false,
  supportsLabels: false,
  supportsAssignees: false,
  supportsMergeStrategies: ['merge', 'squash', 'rebase'] as const,
}

// ---------------------------------------------------------------------------
// Zod parse helpers
// ---------------------------------------------------------------------------

function parsePullRequests(data: unknown): readonly GiteaPullRequest[] {
  return z.array(GiteaPullRequestSchema).parse(data)
}

function parsePullRequest(data: unknown): GiteaPullRequest {
  return GiteaPullRequestSchema.parse(data)
}

function parseReviewComments(data: unknown): readonly GiteaReviewComment[] {
  return z.array(GiteaReviewCommentSchema).parse(data)
}

function parseIssueComments(data: unknown): readonly GiteaIssueComment[] {
  return z.array(GiteaIssueCommentSchema).parse(data)
}

function parseReviews(data: unknown): readonly GiteaReview[] {
  return z.array(GiteaReviewSchema).parse(data)
}

function parseChangedFiles(data: unknown): readonly GiteaChangedFile[] {
  return z.array(GiteaChangedFileSchema).parse(data)
}

function parseCommits(data: unknown): readonly GiteaCommit[] {
  return z.array(GiteaCommitSchema).parse(data)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function mapProviderStateToGiteaState(
  state?: 'open' | 'closed' | 'all',
): string | undefined {
  switch (state) {
    case 'open':
      return 'open'
    case 'closed':
      return 'closed'
    case 'all':
      return undefined
    default:
      return 'open'
  }
}

function mapSortParam(
  sort?: ListPRsParams['sort'],
  direction?: ListPRsParams['direction'],
): Record<string, string> {
  const params: Record<string, string> = {}

  if (sort === 'created') {
    params.sort = 'oldest'
    if (direction === 'desc') params.sort = 'newest'
  } else if (sort === 'updated') {
    params.sort = 'leastupdate'
    if (direction === 'desc') params.sort = 'recentupdate'
  }

  return params
}

// ---------------------------------------------------------------------------
// Gitea Provider factory
// ---------------------------------------------------------------------------

export function createGiteaProvider(config: ProviderConfig): Provider {
  const { baseUrl, token, owner, repo } = config
  const repoBase = `/repos/${owner}/${repo}`

  // Cache the current user for user-scoped queries
  let cachedUsername: string | null = null

  const fetchCurrentUsername = (): Effect.Effect<string, ApiError> =>
    cachedUsername != null
      ? Effect.succeed(cachedUsername)
      : Effect.map(
          getCurrentUser(baseUrl, token),
          (user) => {
            cachedUsername = user.login
            return user.login
          },
        )

  return {
    type: 'gitea',
    capabilities: GITEA_CAPABILITIES,

    // -- PR reads -----------------------------------------------------------

    listPRs: (params: ListPRsParams): Effect.Effect<PRListResult, ApiError> => {
      const queryParams: Record<string, string> = {
        limit: String(params.perPage ?? 30),
        page: String(params.page ?? 1),
      }

      const giteaState = mapProviderStateToGiteaState(params.state)
      if (giteaState != null) {
        queryParams.state = giteaState
      }

      const sortParams = mapSortParam(params.sort, params.direction)
      Object.assign(queryParams, sortParams)

      return Effect.map(
        giteaFetchJson<unknown[]>(
          `${repoBase}/pulls`,
          baseUrl,
          token,
          queryParams,
        ),
        (data) => ({
          items: parsePullRequests(data).map(mapGiteaPRToPullRequest),
        }),
      )
    },

    getPR: (number) =>
      Effect.map(
        giteaFetchJson<unknown>(
          `${repoBase}/pulls/${number}`,
          baseUrl,
          token,
        ),
        (data) => mapGiteaPRToPullRequest(parsePullRequest(data)),
      ),

    getPRFiles: (number) =>
      Effect.map(
        giteaFetchAllPages<unknown>(
          `${repoBase}/pulls/${number}/files`,
          baseUrl,
          token,
        ),
        (data) =>
          mapGiteaChangedFilesToFileChanges(parseChangedFiles(data)),
      ),

    getPRComments: (number) =>
      Effect.gen(function* () {
        // Get review comments from all reviews
        const reviews = yield* giteaFetchAllPages<unknown>(
          `${repoBase}/pulls/${number}/reviews`,
          baseUrl,
          token,
        )

        const parsedReviews = parseReviews(reviews)
        const allComments: GiteaReviewComment[] = []

        // Fetch comments from each review
        for (const review of parsedReviews) {
          const reviewComments = yield* giteaFetchAllPages<unknown>(
            `${repoBase}/pulls/${number}/reviews/${review.id}/comments`,
            baseUrl,
            token,
          )
          allComments.push(...parseReviewComments(reviewComments))
        }

        return mapGiteaReviewCommentsToComments(allComments)
      }),

    getIssueComments: (issueNumber) =>
      Effect.map(
        giteaFetchAllPages<unknown>(
          `${repoBase}/issues/${issueNumber}/comments`,
          baseUrl,
          token,
        ),
        (data) =>
          mapGiteaIssueCommentsToIssueComments(parseIssueComments(data)),
      ),

    getPRReviews: (number) =>
      Effect.map(
        giteaFetchAllPages<unknown>(
          `${repoBase}/pulls/${number}/reviews`,
          baseUrl,
          token,
        ),
        (data) => mapGiteaReviewsToReviews(parseReviews(data)),
      ),

    getPRCommits: (number) =>
      Effect.map(
        giteaFetchAllPages<unknown>(
          `${repoBase}/pulls/${number}/commits`,
          baseUrl,
          token,
        ),
        (data) => mapGiteaCommitsToCommits(parseCommits(data)),
      ),

    getPRChecks: () =>
      // Gitea doesn't have GitHub-style check runs API
      Effect.succeed(
        new CheckRunsResponse({
          total_count: 0,
          check_runs: [],
        }),
      ),

    getReviewThreads: () =>
      // Gitea does not support review thread resolution
      Effect.succeed([]),

    getCommitDiff: (sha) =>
      Effect.map(
        giteaFetchJson<unknown[]>(
          `${repoBase}/git/commits/${sha}/files`,
          baseUrl,
          token,
        ),
        (data) =>
          mapGiteaChangedFilesToFileChanges(parseChangedFiles(data)),
      ),

    // -- User-scoped queries ------------------------------------------------

    getMyPRs: (stateFilter) =>
      Effect.gen(function* () {
        const username = yield* fetchCurrentUsername()
        const queryParams: Record<string, string> = {
          limit: '50',
        }
        const giteaState = mapProviderStateToGiteaState(stateFilter)
        if (giteaState != null) {
          queryParams.state = giteaState
        }

        // Gitea doesn't have a dedicated "my PRs" endpoint.
        // We filter by listing all PRs and checking the author.
        const data = yield* giteaFetchAllPages<unknown>(
          `${repoBase}/pulls`,
          baseUrl,
          token,
          queryParams,
        )
        return parsePullRequests(data)
          .filter((pr) => pr.user.login === username)
          .map(mapGiteaPRToPullRequest)
      }),

    getReviewRequests: (stateFilter) =>
      Effect.gen(function* () {
        const username = yield* fetchCurrentUsername()
        const queryParams: Record<string, string> = {
          limit: '50',
        }
        const giteaState = mapProviderStateToGiteaState(stateFilter)
        if (giteaState != null) {
          queryParams.state = giteaState
        }

        const data = yield* giteaFetchAllPages<unknown>(
          `${repoBase}/pulls`,
          baseUrl,
          token,
          queryParams,
        )
        return parsePullRequests(data)
          .filter((pr) =>
            pr.requested_reviewers.some((r) => r.login === username),
          )
          .map(mapGiteaPRToPullRequest)
      }),

    getInvolvedPRs: (stateFilter) =>
      Effect.gen(function* () {
        const username = yield* fetchCurrentUsername()
        const queryParams: Record<string, string> = {
          limit: '50',
        }
        const giteaState = mapProviderStateToGiteaState(stateFilter)
        if (giteaState != null) {
          queryParams.state = giteaState
        }

        const data = yield* giteaFetchAllPages<unknown>(
          `${repoBase}/pulls`,
          baseUrl,
          token,
          queryParams,
        )
        return parsePullRequests(data)
          .filter(
            (pr) =>
              pr.user.login === username ||
              pr.requested_reviewers.some((r) => r.login === username) ||
              (pr.assignees ?? []).some((a) => a.login === username),
          )
          .map(mapGiteaPRToPullRequest)
      }),

    // -- Review mutations ---------------------------------------------------

    submitReview: (prNumber, body, event) =>
      submitReview(baseUrl, token, owner, repo, prNumber, body, event),

    createPendingReview: () =>
      // Gitea doesn't have pending reviews
      Effect.succeed({ id: 0 }),

    addPendingReviewComment: (params) =>
      addInlineComment(
        baseUrl,
        token,
        owner,
        repo,
        params.prNumber,
        params.body,
        params.path,
        params.line,
        params.side,
      ),

    submitPendingReview: (prNumber, _reviewId, body, event) =>
      submitReview(baseUrl, token, owner, repo, prNumber, body, event),

    discardPendingReview: () =>
      Effect.succeed(undefined as void),

    // -- Comment mutations --------------------------------------------------

    addComment: (issueNumber, body) =>
      addComment(baseUrl, token, owner, repo, issueNumber, body),

    addDiffComment: (params: AddDiffCommentParams) =>
      addInlineComment(
        baseUrl,
        token,
        owner,
        repo,
        params.prNumber,
        params.body,
        params.path,
        params.line,
        params.side,
        params.commitId,
      ),

    replyToComment: (prNumber, commentId, body) =>
      // Gitea replies need the review ID, but we only have the comment ID.
      // Fall back to adding an issue-level comment as a reply.
      addComment(baseUrl, token, owner, repo, prNumber, body),

    editIssueComment: (commentId, body) =>
      editIssueComment(baseUrl, token, owner, repo, commentId, body),

    editReviewComment: (commentId, body) =>
      // Gitea uses the same endpoint for editing issue comments
      editIssueComment(baseUrl, token, owner, repo, commentId, body),

    deleteReviewComment: (commentId) =>
      deleteIssueComment(baseUrl, token, owner, repo, commentId),

    // -- PR state mutations -------------------------------------------------

    mergePR: (prNumber, method, commitTitle, commitMessage) =>
      mergePR(baseUrl, token, owner, repo, prNumber, method, commitTitle, commitMessage),

    closePR: (prNumber) =>
      closePR(baseUrl, token, owner, repo, prNumber),

    reopenPR: (prNumber) =>
      reopenPR(baseUrl, token, owner, repo, prNumber),

    updatePRTitle: (prNumber, title) =>
      updatePRTitle(baseUrl, token, owner, repo, prNumber, title),

    updatePRBody: (prNumber, body) =>
      updatePRBody(baseUrl, token, owner, repo, prNumber, body),

    requestReReview: (prNumber, reviewers) => {
      if (reviewers.length === 0) {
        return Effect.fail(
          new GiteaError({
            message: 'At least one reviewer is required',
            status: 400,
          }),
        )
      }
      return requestReReview(baseUrl, token, owner, repo, prNumber, reviewers)
    },

    // -- Thread operations (not supported) ----------------------------------

    resolveThread: () =>
      Effect.fail(
        new GiteaError({
          message: 'Gitea does not support thread resolution',
          status: 400,
        }),
      ),

    unresolveThread: () =>
      Effect.fail(
        new GiteaError({
          message: 'Gitea does not support thread resolution',
          status: 400,
        }),
      ),

    // -- Draft operations (not supported) -----------------------------------

    convertToDraft: () =>
      Effect.fail(
        new GiteaError({
          message: 'Gitea does not support draft pull requests',
          status: 400,
        }),
      ),

    markReadyForReview: () =>
      Effect.fail(
        new GiteaError({
          message: 'Gitea does not support draft pull requests',
          status: 400,
        }),
      ),

    // -- PR creation (not yet supported for Gitea) ---------------------------

    createPR: () =>
      Effect.fail(
        new GiteaError({ message: 'PR creation is not yet supported for Gitea', status: 501 }),
      ),

    // -- Label operations (not supported for Gitea) --------------------------

    getLabels: () =>
      Effect.fail(
        new GiteaError({ message: 'Labels are not yet supported for Gitea', status: 501 }),
      ),

    setLabels: () =>
      Effect.fail(
        new GiteaError({ message: 'Labels are not yet supported for Gitea', status: 501 }),
      ),

    // -- Assignee operations (not supported for Gitea) ------------------------

    getCollaborators: () =>
      Effect.fail(
        new GiteaError({ message: 'Assignee management is not yet supported for Gitea', status: 501 }),
      ),

    updateAssignees: () =>
      Effect.fail(
        new GiteaError({ message: 'Assignee management is not yet supported for Gitea', status: 501 }),
      ),

    // -- User info ----------------------------------------------------------

    getCurrentUser: () =>
      Effect.map(
        getCurrentUser(baseUrl, token),
        (user) => ({ login: user.login }),
      ),
  }
}
