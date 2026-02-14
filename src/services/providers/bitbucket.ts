import { Effect } from 'effect'
import { z } from 'zod'
import { BitbucketError } from '../../models/errors'
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
  bitbucketFetchJson,
  bitbucketFetchAllPages,
} from '../BitbucketApiHelpers'
import {
  BitbucketPullRequestSchema,
  BitbucketCommentSchema,
  BitbucketDiffStatSchema,
  BitbucketCommitSchema,
  BitbucketPipelineStepSchema,
  mapBitbucketPRToPullRequest,
  mapBitbucketCommentsToComments,
  mapBitbucketCommentsToIssueComments,
  mapBitbucketDiffStatToFileChange,
  mapBitbucketCommitToCommit,
  mapBitbucketPipelineStepsToCheckRunsResponse,
  mapParticipantsToReviews,
} from '../../models/bitbucket'
import type {
  BitbucketPullRequest,
  BitbucketComment,
  BitbucketDiffStat,
  BitbucketCommit,
  BitbucketPipelineStep,
} from '../../models/bitbucket'
import { CheckRunsResponse } from '../../models/check'
import {
  approvePR,
  unapprovePR,
  addComment,
  addInlineComment,
  replyToComment,
  editComment,
  deleteComment,
  mergePR,
  declinePR,
  updatePRTitle,
  updatePRDescription,
  updateReviewers,
  getCurrentUser,
} from './bitbucket-mutations'

// ---------------------------------------------------------------------------
// Bitbucket capabilities
// ---------------------------------------------------------------------------

const BITBUCKET_CAPABILITIES: ProviderCapabilities = {
  supportsDraftPR: false,
  supportsReviewThreads: false,
  supportsGraphQL: false,
  supportsReactions: false,
  supportsCheckRuns: true,
  supportsLabels: false,
  supportsAssignees: false,
  supportsMergeStrategies: ['merge', 'squash', 'rebase'] as const,
}

// ---------------------------------------------------------------------------
// Zod schemas for Bitbucket-specific response shapes
// ---------------------------------------------------------------------------

const BitbucketPipelineSchema = z.object({
  uuid: z.string(),
  state: z.object({
    name: z.string(),
  }),
  target: z.object({
    ref_name: z.string().optional(),
  }).optional(),
})

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function mapProviderStateToBitbucketState(
  state?: 'open' | 'closed' | 'all',
): string | undefined {
  switch (state) {
    case 'open':
      return 'OPEN'
    case 'closed':
      return 'MERGED,DECLINED,SUPERSEDED'
    case 'all':
      return undefined
    default:
      return 'OPEN'
  }
}

// ---------------------------------------------------------------------------
// Parse helpers with Zod validation
// ---------------------------------------------------------------------------

function parsePullRequests(data: unknown): readonly BitbucketPullRequest[] {
  return z.array(BitbucketPullRequestSchema).parse(data)
}

function parsePullRequest(data: unknown): BitbucketPullRequest {
  return BitbucketPullRequestSchema.parse(data)
}

function parseComments(data: unknown): readonly BitbucketComment[] {
  return z.array(BitbucketCommentSchema).parse(data)
}

function parseDiffStats(data: unknown): readonly BitbucketDiffStat[] {
  return z.array(BitbucketDiffStatSchema).parse(data)
}

function parseCommits(data: unknown): readonly BitbucketCommit[] {
  return z.array(BitbucketCommitSchema).parse(data)
}

function parsePipelineSteps(data: unknown): readonly BitbucketPipelineStep[] {
  return z.array(BitbucketPipelineStepSchema).parse(data)
}

// ---------------------------------------------------------------------------
// Bitbucket Provider factory
// ---------------------------------------------------------------------------

export function createBitbucketProvider(config: ProviderConfig): Provider {
  const { baseUrl, token, owner, repo } = config
  const repoBase = `/repositories/${owner}/${repo}`

  // Cache the current user for user-scoped queries
  let cachedUsername: string | null = null

  const fetchCurrentUsername = (): Effect.Effect<string, ApiError> =>
    cachedUsername != null
      ? Effect.succeed(cachedUsername)
      : Effect.map(
          getCurrentUser(baseUrl, token),
          (user) => {
            cachedUsername = user.username
            return user.username
          },
        )

  return {
    type: 'bitbucket',
    capabilities: BITBUCKET_CAPABILITIES,

    // -- PR reads -----------------------------------------------------------

    listPRs: (params: ListPRsParams): Effect.Effect<PRListResult, ApiError> => {
      const queryParams: Record<string, string> = {
        pagelen: String(params.perPage ?? 30),
        page: String(params.page ?? 1),
      }

      const bbState = mapProviderStateToBitbucketState(params.state)
      if (bbState != null) {
        queryParams.state = bbState
      }

      if (params.sort) {
        // Bitbucket sorting: prepend '-' for descending
        const prefix = params.direction === 'asc' ? '' : '-'
        queryParams.sort = `${prefix}${params.sort === 'updated' ? 'updated_on' : 'created_on'}`
      }

      return Effect.map(
        bitbucketFetchAllPages<unknown>(
          `${repoBase}/pullrequests`,
          baseUrl,
          token,
          queryParams,
        ),
        (data) => ({
          items: parsePullRequests(data).map(mapBitbucketPRToPullRequest),
        }),
      )
    },

    getPR: (number) =>
      Effect.map(
        bitbucketFetchJson<unknown>(
          `${repoBase}/pullrequests/${number}`,
          baseUrl,
          token,
        ),
        (data) => mapBitbucketPRToPullRequest(parsePullRequest(data)),
      ),

    getPRFiles: (number) =>
      Effect.map(
        bitbucketFetchAllPages<unknown>(
          `${repoBase}/pullrequests/${number}/diffstat`,
          baseUrl,
          token,
        ),
        (data) => parseDiffStats(data).map(mapBitbucketDiffStatToFileChange),
      ),

    getPRFilesPage: (number, _page) =>
      Effect.map(
        bitbucketFetchAllPages<unknown>(
          `${repoBase}/pullrequests/${number}/diffstat`,
          baseUrl,
          token,
        ),
        (data) => ({
          items: parseDiffStats(data).map(mapBitbucketDiffStatToFileChange),
          hasNextPage: false,
        }),
      ),

    getFileDiff: (number, filename) =>
      Effect.map(
        bitbucketFetchAllPages<unknown>(
          `${repoBase}/pullrequests/${number}/diffstat`,
          baseUrl,
          token,
        ),
        (data) =>
          parseDiffStats(data).map(mapBitbucketDiffStatToFileChange).find((f) => f.filename === filename) ?? null,
      ),

    getPRComments: (number) =>
      Effect.gen(function* () {
        const [commentsData, prData] = yield* Effect.all([
          bitbucketFetchAllPages<unknown>(
            `${repoBase}/pullrequests/${number}/comments`,
            baseUrl,
            token,
          ),
          bitbucketFetchJson<unknown>(
            `${repoBase}/pullrequests/${number}`,
            baseUrl,
            token,
          ),
        ])

        const comments = parseComments(commentsData)
        const pr = parsePullRequest(prData)
        const prHtmlUrl = pr.links.html.href

        // Only inline (diff-attached) comments
        const inlineComments = comments.filter((c) => !c.deleted && c.inline != null)
        return mapBitbucketCommentsToComments(inlineComments, prHtmlUrl)
      }),

    getIssueComments: (issueNumber) =>
      Effect.gen(function* () {
        const [commentsData, prData] = yield* Effect.all([
          bitbucketFetchAllPages<unknown>(
            `${repoBase}/pullrequests/${issueNumber}/comments`,
            baseUrl,
            token,
          ),
          bitbucketFetchJson<unknown>(
            `${repoBase}/pullrequests/${issueNumber}`,
            baseUrl,
            token,
          ),
        ])

        const comments = parseComments(commentsData)
        const pr = parsePullRequest(prData)

        return mapBitbucketCommentsToIssueComments(comments, pr.links.html.href)
      }),

    getPRReviews: (number) =>
      Effect.map(
        bitbucketFetchJson<unknown>(
          `${repoBase}/pullrequests/${number}`,
          baseUrl,
          token,
        ),
        (data) => {
          const pr = parsePullRequest(data)
          return mapParticipantsToReviews(
            pr.participants,
            pr.links.html.href,
            pr.updated_on,
          )
        },
      ),

    getPRCommits: (number) =>
      Effect.map(
        bitbucketFetchAllPages<unknown>(
          `${repoBase}/pullrequests/${number}/commits`,
          baseUrl,
          token,
        ),
        (data) => parseCommits(data).map(mapBitbucketCommitToCommit),
      ),

    getPRChecks: (ref) =>
      Effect.gen(function* () {
        // Bitbucket: get pipelines for the branch, then get steps from most recent
        const pipelinesData = yield* bitbucketFetchJson<{
          readonly values: readonly unknown[]
        }>(
          `${repoBase}/pipelines/?target.branch=${encodeURIComponent(ref)}&pagelen=1&sort=-created_on`,
          baseUrl,
          token,
        )

        const pipelines = z.array(BitbucketPipelineSchema).parse(
          pipelinesData.values ?? [],
        )

        if (pipelines.length === 0) {
          return new CheckRunsResponse({
            total_count: 0,
            check_runs: [],
          })
        }

        const pipelineUuid = pipelines[0]!.uuid
        const stepsData = yield* bitbucketFetchAllPages<unknown>(
          `${repoBase}/pipelines/${pipelineUuid}/steps`,
          baseUrl,
          token,
        )

        return mapBitbucketPipelineStepsToCheckRunsResponse(
          parsePipelineSteps(stepsData),
        )
      }),

    getReviewThreads: () =>
      // Bitbucket does not support review threads
      Effect.succeed([]),

    getCommitDiff: (sha) =>
      Effect.map(
        bitbucketFetchAllPages<unknown>(
          `${repoBase}/diffstat/${sha}`,
          baseUrl,
          token,
        ),
        (data) => parseDiffStats(data).map(mapBitbucketDiffStatToFileChange),
      ),

    // -- User-scoped queries ------------------------------------------------

    getMyPRs: (stateFilter) =>
      Effect.gen(function* () {
        const username = yield* fetchCurrentUsername()
        const queryParams: Record<string, string> = {}
        const bbState = mapProviderStateToBitbucketState(stateFilter)
        if (bbState != null) {
          queryParams.state = bbState
        }
        queryParams.q = `author.username="${username}"`

        const data = yield* bitbucketFetchAllPages<unknown>(
          `${repoBase}/pullrequests`,
          baseUrl,
          token,
          queryParams,
        )
        return parsePullRequests(data).map(mapBitbucketPRToPullRequest)
      }),

    getReviewRequests: (stateFilter) =>
      Effect.gen(function* () {
        const username = yield* fetchCurrentUsername()
        const queryParams: Record<string, string> = {}
        const bbState = mapProviderStateToBitbucketState(stateFilter)
        if (bbState != null) {
          queryParams.state = bbState
        }
        queryParams.q = `reviewers.username="${username}"`

        const data = yield* bitbucketFetchAllPages<unknown>(
          `${repoBase}/pullrequests`,
          baseUrl,
          token,
          queryParams,
        )
        return parsePullRequests(data).map(mapBitbucketPRToPullRequest)
      }),

    getInvolvedPRs: (stateFilter) =>
      Effect.gen(function* () {
        const username = yield* fetchCurrentUsername()
        const queryParams: Record<string, string> = {}
        const bbState = mapProviderStateToBitbucketState(stateFilter)
        if (bbState != null) {
          queryParams.state = bbState
        }
        queryParams.q = `participants.username="${username}"`

        const data = yield* bitbucketFetchAllPages<unknown>(
          `${repoBase}/pullrequests`,
          baseUrl,
          token,
          queryParams,
        )
        return parsePullRequests(data).map(mapBitbucketPRToPullRequest)
      }),

    // -- Review mutations ---------------------------------------------------

    submitReview: (prNumber, body, event) => {
      switch (event) {
        case 'APPROVE':
          return Effect.gen(function* () {
            yield* approvePR(baseUrl, token, owner, repo, prNumber)
            if (body.trim().length > 0) {
              yield* addComment(baseUrl, token, owner, repo, prNumber, body)
            }
          })
        case 'REQUEST_CHANGES':
          // Bitbucket doesn't have explicit "request changes" -- add a comment
          return addComment(
            baseUrl,
            token,
            owner,
            repo,
            prNumber,
            body.trim().length > 0 ? body : 'Changes requested.',
          )
        case 'COMMENT':
          return addComment(
            baseUrl,
            token,
            owner,
            repo,
            prNumber,
            body.trim().length > 0 ? body : 'Review comment.',
          )
      }
    },

    // Bitbucket doesn't have pending reviews -- immediate submission
    createPendingReview: () =>
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

    submitPendingReview: (prNumber, _reviewId, body, event) => {
      switch (event) {
        case 'APPROVE':
          return Effect.gen(function* () {
            yield* approvePR(baseUrl, token, owner, repo, prNumber)
            if (body.trim().length > 0) {
              yield* addComment(baseUrl, token, owner, repo, prNumber, body)
            }
          })
        case 'REQUEST_CHANGES':
          return addComment(
            baseUrl,
            token,
            owner,
            repo,
            prNumber,
            body.trim().length > 0 ? body : 'Changes requested.',
          )
        case 'COMMENT':
          return body.trim().length > 0
            ? addComment(baseUrl, token, owner, repo, prNumber, body)
            : Effect.succeed(undefined as void)
      }
    },

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
      ),

    replyToComment: (prNumber, commentId, body) =>
      replyToComment(
        baseUrl,
        token,
        owner,
        repo,
        prNumber,
        commentId,
        body,
      ),

    editIssueComment: (commentId, body) =>
      // Bitbucket requires the PR number to edit a comment.
      // Since the provider interface only passes commentId, we store a
      // PR-scoped comment ID. The caller must track which PR the comment
      // belongs to. For now we use 0 as a placeholder.
      editComment(baseUrl, token, owner, repo, 0, commentId, body),

    editReviewComment: (commentId, body) =>
      editComment(baseUrl, token, owner, repo, 0, commentId, body),

    deleteReviewComment: (commentId) =>
      deleteComment(baseUrl, token, owner, repo, 0, commentId),

    // -- PR state mutations -------------------------------------------------

    mergePR: (prNumber, method, commitTitle, commitMessage) =>
      mergePR(baseUrl, token, owner, repo, prNumber, method, commitTitle, commitMessage),

    closePR: (prNumber) =>
      declinePR(baseUrl, token, owner, repo, prNumber),

    reopenPR: () =>
      // Bitbucket does not support reopening declined PRs
      Effect.fail(
        new BitbucketError({
          message: 'Bitbucket does not support reopening declined pull requests. Create a new PR instead.',
          status: 400,
        }),
      ),

    updatePRTitle: (prNumber, title) =>
      updatePRTitle(baseUrl, token, owner, repo, prNumber, title),

    updatePRBody: (prNumber, body) =>
      updatePRDescription(baseUrl, token, owner, repo, prNumber, body),

    requestReReview: (prNumber, reviewers) => {
      if (reviewers.length === 0) {
        return Effect.fail(
          new BitbucketError({
            message: 'At least one reviewer UUID is required',
            status: 400,
          }),
        )
      }
      return updateReviewers(baseUrl, token, owner, repo, prNumber, reviewers)
    },

    // -- Thread operations (not supported) ----------------------------------

    resolveThread: () =>
      Effect.fail(
        new BitbucketError({
          message: 'Bitbucket does not support thread resolution',
          status: 400,
        }),
      ),

    unresolveThread: () =>
      Effect.fail(
        new BitbucketError({
          message: 'Bitbucket does not support thread resolution',
          status: 400,
        }),
      ),

    // -- Draft operations (not supported) -----------------------------------

    convertToDraft: () =>
      Effect.fail(
        new BitbucketError({
          message: 'Bitbucket does not support draft pull requests',
          status: 400,
        }),
      ),

    markReadyForReview: () =>
      Effect.fail(
        new BitbucketError({
          message: 'Bitbucket does not support draft pull requests',
          status: 400,
        }),
      ),

    // -- PR creation (not yet supported for Bitbucket) -----------------------

    createPR: () =>
      Effect.fail(
        new BitbucketError({ message: 'PR creation is not yet supported for Bitbucket', status: 501 }),
      ),

    // -- Label operations (not supported for Bitbucket) ----------------------

    getLabels: () =>
      Effect.fail(
        new BitbucketError({ message: 'Labels are not yet supported for Bitbucket', status: 501 }),
      ),

    setLabels: () =>
      Effect.fail(
        new BitbucketError({ message: 'Labels are not yet supported for Bitbucket', status: 501 }),
      ),

    // -- Assignee operations (not supported for Bitbucket) --------------------

    getCollaborators: () =>
      Effect.fail(
        new BitbucketError({ message: 'Assignee management is not yet supported for Bitbucket', status: 501 }),
      ),

    updateAssignees: () =>
      Effect.fail(
        new BitbucketError({ message: 'Assignee management is not yet supported for Bitbucket', status: 501 }),
      ),

    // -- Reaction operations (not supported for Bitbucket) --------------------

    addReaction: () =>
      Effect.fail(
        new BitbucketError({ message: 'Reactions are not supported for Bitbucket', status: 501 }),
      ),

    // -- User info ----------------------------------------------------------

    getCurrentUser: () =>
      Effect.map(
        getCurrentUser(baseUrl, token),
        (user) => ({ login: user.username }),
      ),
  }
}
