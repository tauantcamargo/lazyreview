import { Effect } from 'effect'
import { z } from 'zod'
import { AzureError } from '../../models/errors'
import type { ApiError } from '../CodeReviewApiTypes'
import type { ReviewThread } from '../CodeReviewApiTypes'
import type {
  Provider,
  ProviderConfig,
  ProviderCapabilities,
  ListPRsParams,
  PRListResult,
  AddDiffCommentParams,
} from './types'
import {
  azureFetchJson,
  azureFetchAllPages,
} from '../AzureApiHelpers'
import {
  AzurePullRequestSchema,
  AzureThreadSchema,
  AzureIterationSchema,
  AzureIterationChangeSchema,
  AzureCommitSchema,
  AzureBuildSchema,
  mapAzurePRToPullRequest,
  mapAzureThreadsToComments,
  mapAzureThreadsToIssueComments,
  mapAzureChangeToFileChange,
  mapAzureCommitToCommit,
  mapAzureBuildsToCheckRunsResponse,
  mapAzureReviewersToReviews,
} from '../../models/azure'
import type {
  AzurePullRequest,
  AzureThread,
  AzureIteration,
  AzureIterationChange,
  AzureCommit,
  AzureBuild,
} from '../../models/azure'
import { CheckRunsResponse } from '../../models/check'
import { parseAzureOwner } from './azure-helpers'
import {
  votePR,
  createThread,
  replyToThread,
  editComment,
  deleteComment,
  updateThreadStatus,
  updatePRStatus,
  updatePRTitle,
  updatePRDescription,
  setDraftStatus,
  addReviewer,
  getConnectionData,
} from './azure-mutations'

// ---------------------------------------------------------------------------
// Azure DevOps capabilities
// ---------------------------------------------------------------------------

const AZURE_CAPABILITIES: ProviderCapabilities = {
  supportsDraftPR: true,
  supportsReviewThreads: true,
  supportsGraphQL: false,
  supportsReactions: false,
  supportsCheckRuns: true,
  supportsLabels: false,
  supportsMergeStrategies: ['noFastForward', 'squash', 'rebase', 'rebaseMerge'] as const,
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function mapProviderStateToAzureStatus(
  state?: 'open' | 'closed' | 'all',
): string {
  switch (state) {
    case 'open':
      return 'active'
    case 'closed':
      return 'completed'
    case 'all':
      return 'all'
    default:
      return 'active'
  }
}

/**
 * Map normalized merge method to Azure DevOps completion options.
 */
function mapMergeMethod(
  method: 'merge' | 'squash' | 'rebase',
): { readonly mergeStrategy: number } {
  switch (method) {
    case 'merge':
      return { mergeStrategy: 1 } // noFastForward
    case 'squash':
      return { mergeStrategy: 3 } // squash
    case 'rebase':
      return { mergeStrategy: 2 } // rebase
  }
}

// ---------------------------------------------------------------------------
// Parse helpers with Zod validation
// ---------------------------------------------------------------------------

function parsePullRequests(data: unknown): readonly AzurePullRequest[] {
  return z.array(AzurePullRequestSchema).parse(data)
}

function parsePullRequest(data: unknown): AzurePullRequest {
  return AzurePullRequestSchema.parse(data)
}

function parseThreads(data: unknown): readonly AzureThread[] {
  return z.array(AzureThreadSchema).parse(data)
}

function parseIterations(data: unknown): readonly AzureIteration[] {
  return z.array(AzureIterationSchema).parse(data)
}

function parseIterationChanges(data: unknown): readonly AzureIterationChange[] {
  return z.array(AzureIterationChangeSchema).parse(data)
}

function parseCommits(data: unknown): readonly AzureCommit[] {
  return z.array(AzureCommitSchema).parse(data)
}

function parseBuilds(data: unknown): readonly AzureBuild[] {
  return z.array(AzureBuildSchema).parse(data)
}

// ---------------------------------------------------------------------------
// Thread ID encoding
//
// Azure thread resolution requires the PR ID and thread ID.
// We encode both into the thread ID string as "prId:threadId" so the
// resolveThread/unresolveThread methods can operate without extra context.
// ---------------------------------------------------------------------------

export function encodeAzureThreadId(prId: number, threadId: number): string {
  return `${prId}:${threadId}`
}

export function decodeAzureThreadId(
  encoded: string,
): { readonly prId: number; readonly threadId: number } {
  const separatorIndex = encoded.indexOf(':')
  if (separatorIndex === -1) {
    return { prId: 0, threadId: parseInt(encoded, 10) || 0 }
  }
  const prId = parseInt(encoded.slice(0, separatorIndex), 10)
  const threadId = parseInt(encoded.slice(separatorIndex + 1), 10)
  return {
    prId: Number.isFinite(prId) ? prId : 0,
    threadId: Number.isFinite(threadId) ? threadId : 0,
  }
}

// ---------------------------------------------------------------------------
// Azure DevOps Provider factory
// ---------------------------------------------------------------------------

export function createAzureProvider(config: ProviderConfig): Provider {
  const { baseUrl, token, owner, repo } = config
  const { org, project } = parseAzureOwner(owner)
  const repoBase = `/${org}/${project}/_apis/git/repositories/${repo}`

  // Cache the current user for user-scoped queries
  let cachedUserId: string | null = null
  let cachedUserName: string | null = null

  const fetchCurrentUser = (): Effect.Effect<
    { readonly id: string; readonly displayName: string },
    ApiError
  > =>
    cachedUserId != null && cachedUserName != null
      ? Effect.succeed({ id: cachedUserId, displayName: cachedUserName })
      : Effect.map(
          getConnectionData(baseUrl, token, owner),
          (data) => {
            cachedUserId = data.authenticatedUser.id
            cachedUserName = data.authenticatedUser.providerDisplayName
            return {
              id: data.authenticatedUser.id,
              displayName: data.authenticatedUser.providerDisplayName,
            }
          },
        )

  /**
   * Build the PR HTML URL for this repo.
   */
  const buildPRUrl = (prId: number): string =>
    `${baseUrl}/${org}/${project}/_git/${repo}/pullrequest/${prId}`

  return {
    type: 'azure',
    capabilities: AZURE_CAPABILITIES,

    // -- PR reads -----------------------------------------------------------

    listPRs: (params: ListPRsParams): Effect.Effect<PRListResult, ApiError> => {
      const azureStatus = mapProviderStateToAzureStatus(params.state)
      const queryParams: Record<string, string> = {
        'searchCriteria.status': azureStatus,
      }

      if (params.perPage) {
        queryParams.$top = String(params.perPage)
      }
      if (params.page && params.perPage) {
        queryParams.$skip = String((params.page - 1) * params.perPage)
      }

      return Effect.map(
        azureFetchJson<{ readonly value: readonly unknown[] }>(
          `${repoBase}/pullrequests`,
          baseUrl,
          token,
          queryParams,
        ),
        (data) => ({
          items: parsePullRequests(data.value).map((pr) =>
            mapAzurePRToPullRequest(pr, baseUrl, org, project, repo),
          ),
        }),
      )
    },

    getPR: (number) =>
      Effect.map(
        azureFetchJson<unknown>(
          `${repoBase}/pullrequests/${number}`,
          baseUrl,
          token,
        ),
        (data) =>
          mapAzurePRToPullRequest(
            parsePullRequest(data),
            baseUrl,
            org,
            project,
            repo,
          ),
      ),

    getPRFiles: (number) =>
      Effect.gen(function* () {
        // Get iterations to find the latest
        const iterationsData = yield* azureFetchJson<{
          readonly value: readonly unknown[]
        }>(
          `${repoBase}/pullrequests/${number}/iterations`,
          baseUrl,
          token,
        )

        const iterations = parseIterations(iterationsData.value)
        if (iterations.length === 0) {
          return []
        }

        const latestIterationId = iterations[iterations.length - 1]!.id

        // Get changes for the latest iteration
        const changesData = yield* azureFetchJson<{
          readonly changeEntries: readonly unknown[]
        }>(
          `${repoBase}/pullrequests/${number}/iterations/${latestIterationId}/changes`,
          baseUrl,
          token,
        )

        return parseIterationChanges(changesData.changeEntries).map(
          mapAzureChangeToFileChange,
        )
      }),

    getPRComments: (number) =>
      Effect.map(
        azureFetchJson<{ readonly value: readonly unknown[] }>(
          `${repoBase}/pullrequests/${number}/threads`,
          baseUrl,
          token,
        ),
        (data) =>
          mapAzureThreadsToComments(
            parseThreads(data.value),
            buildPRUrl(number),
          ),
      ),

    getIssueComments: (issueNumber) =>
      Effect.map(
        azureFetchJson<{ readonly value: readonly unknown[] }>(
          `${repoBase}/pullrequests/${issueNumber}/threads`,
          baseUrl,
          token,
        ),
        (data) =>
          mapAzureThreadsToIssueComments(
            parseThreads(data.value),
            buildPRUrl(issueNumber),
          ),
      ),

    getPRReviews: (number) =>
      Effect.map(
        azureFetchJson<unknown>(
          `${repoBase}/pullrequests/${number}`,
          baseUrl,
          token,
        ),
        (data) => {
          const pr = parsePullRequest(data)
          return mapAzureReviewersToReviews(
            pr.reviewers,
            buildPRUrl(number),
            pr.closedDate ?? pr.creationDate,
          )
        },
      ),

    getPRCommits: (number) =>
      Effect.map(
        azureFetchJson<{ readonly value: readonly unknown[] }>(
          `${repoBase}/pullrequests/${number}/commits`,
          baseUrl,
          token,
        ),
        (data) => parseCommits(data.value).map((c) => mapAzureCommitToCommit(c)),
      ),

    getPRChecks: (ref) =>
      Effect.gen(function* () {
        // Azure DevOps: get builds for the source branch
        const branchName = ref.startsWith('refs/heads/')
          ? ref
          : `refs/heads/${ref}`

        const buildsData = yield* azureFetchJson<{
          readonly value: readonly unknown[]
        }>(
          `/${org}/${project}/_apis/build/builds`,
          baseUrl,
          token,
          {
            branchName,
            $top: '50',
            queryOrder: 'finishTimeDescending',
          },
        )

        const builds = parseBuilds(buildsData.value)

        if (builds.length === 0) {
          return new CheckRunsResponse({
            total_count: 0,
            check_runs: [],
          })
        }

        return mapAzureBuildsToCheckRunsResponse(builds)
      }),

    getReviewThreads: (prNumber) =>
      Effect.map(
        azureFetchJson<{ readonly value: readonly unknown[] }>(
          `${repoBase}/pullrequests/${prNumber}/threads`,
          baseUrl,
          token,
        ),
        (data) => {
          const threads = parseThreads(data.value)
          return threads
            .filter(
              (thread) =>
                !thread.isDeleted &&
                thread.threadContext != null &&
                thread.comments.some(
                  (c) => c.commentType !== 'system' && c.commentType !== 'codeChange',
                ),
            )
            .map(
              (thread): ReviewThread => ({
                id: encodeAzureThreadId(prNumber, thread.id),
                isResolved:
                  thread.status === 'fixed' ||
                  thread.status === 'closed' ||
                  thread.status === 'wontFix' ||
                  thread.status === 'byDesign',
                comments: thread.comments
                  .filter((c) => c.commentType !== 'system')
                  .map((c) => ({ databaseId: c.id })),
              }),
            )
        },
      ),

    getCommitDiff: (sha) =>
      Effect.map(
        azureFetchJson<{
          readonly changes: readonly unknown[]
        }>(
          `${repoBase}/commits/${sha}/changes`,
          baseUrl,
          token,
        ),
        (data) => {
          const changes = z
            .array(AzureIterationChangeSchema)
            .parse(
              (data.changes ?? []).map((c: unknown) => {
                const entry = c as Record<string, unknown>
                return {
                  changeType: entry.changeType,
                  item: entry.item,
                  originalPath: (entry as Record<string, unknown>).sourceServerItem,
                }
              }),
            )
          return changes.map(mapAzureChangeToFileChange)
        },
      ),

    // -- User-scoped queries ------------------------------------------------

    getMyPRs: (stateFilter) =>
      Effect.gen(function* () {
        const user = yield* fetchCurrentUser()
        const azureStatus = mapProviderStateToAzureStatus(stateFilter)

        const data = yield* azureFetchJson<{
          readonly value: readonly unknown[]
        }>(
          `${repoBase}/pullrequests`,
          baseUrl,
          token,
          {
            'searchCriteria.status': azureStatus,
            'searchCriteria.creatorId': user.id,
          },
        )

        return parsePullRequests(data.value).map((pr) =>
          mapAzurePRToPullRequest(pr, baseUrl, org, project, repo),
        )
      }),

    getReviewRequests: (stateFilter) =>
      Effect.gen(function* () {
        const user = yield* fetchCurrentUser()
        const azureStatus = mapProviderStateToAzureStatus(stateFilter)

        const data = yield* azureFetchJson<{
          readonly value: readonly unknown[]
        }>(
          `${repoBase}/pullrequests`,
          baseUrl,
          token,
          {
            'searchCriteria.status': azureStatus,
            'searchCriteria.reviewerId': user.id,
          },
        )

        return parsePullRequests(data.value).map((pr) =>
          mapAzurePRToPullRequest(pr, baseUrl, org, project, repo),
        )
      }),

    getInvolvedPRs: (stateFilter) => {
      const azureStatus = mapProviderStateToAzureStatus(stateFilter)

      return Effect.map(
        azureFetchJson<{ readonly value: readonly unknown[] }>(
          `${repoBase}/pullrequests`,
          baseUrl,
          token,
          {
            'searchCriteria.status': azureStatus,
          },
        ),
        (data) =>
          parsePullRequests(data.value).map((pr) =>
            mapAzurePRToPullRequest(pr, baseUrl, org, project, repo),
          ),
      )
    },

    // -- Review mutations ---------------------------------------------------

    submitReview: (prNumber, body, event) =>
      Effect.gen(function* () {
        const user = yield* fetchCurrentUser()

        switch (event) {
          case 'APPROVE':
            yield* votePR(baseUrl, token, owner, repo, prNumber, user.id, 10)
            if (body.trim().length > 0) {
              yield* createThread(baseUrl, token, owner, repo, prNumber, body)
            }
            break
          case 'REQUEST_CHANGES':
            yield* votePR(baseUrl, token, owner, repo, prNumber, user.id, -5)
            yield* createThread(
              baseUrl,
              token,
              owner,
              repo,
              prNumber,
              body.trim().length > 0 ? body : 'Changes requested.',
            )
            break
          case 'COMMENT':
            yield* createThread(
              baseUrl,
              token,
              owner,
              repo,
              prNumber,
              body.trim().length > 0 ? body : 'Review comment.',
            )
            break
        }
      }),

    // Azure DevOps doesn't have pending reviews -- immediate submission
    createPendingReview: () => Effect.succeed({ id: 0 }),

    addPendingReviewComment: (params) =>
      createThread(baseUrl, token, owner, repo, params.prNumber, params.body, {
        filePath: `/${params.path}`,
        ...(params.side === 'RIGHT'
          ? {
              rightFileStart: { line: params.line, offset: 1 },
              rightFileEnd: { line: params.line, offset: 1 },
            }
          : {
              leftFileStart: { line: params.line, offset: 1 },
              leftFileEnd: { line: params.line, offset: 1 },
            }),
      }),

    submitPendingReview: (prNumber, _reviewId, body, event) =>
      Effect.gen(function* () {
        const user = yield* fetchCurrentUser()

        switch (event) {
          case 'APPROVE':
            yield* votePR(baseUrl, token, owner, repo, prNumber, user.id, 10)
            if (body.trim().length > 0) {
              yield* createThread(baseUrl, token, owner, repo, prNumber, body)
            }
            break
          case 'REQUEST_CHANGES':
            yield* votePR(baseUrl, token, owner, repo, prNumber, user.id, -5)
            if (body.trim().length > 0) {
              yield* createThread(baseUrl, token, owner, repo, prNumber, body)
            }
            break
          case 'COMMENT':
            if (body.trim().length > 0) {
              yield* createThread(baseUrl, token, owner, repo, prNumber, body)
            }
            break
        }
      }),

    discardPendingReview: () => Effect.succeed(undefined as void),

    // -- Comment mutations --------------------------------------------------

    addComment: (issueNumber, body) =>
      createThread(baseUrl, token, owner, repo, issueNumber, body),

    addDiffComment: (params: AddDiffCommentParams) =>
      createThread(baseUrl, token, owner, repo, params.prNumber, params.body, {
        filePath: `/${params.path}`,
        ...(params.side === 'RIGHT'
          ? {
              rightFileStart: { line: params.line, offset: 1 },
              rightFileEnd: { line: params.line, offset: 1 },
            }
          : {
              leftFileStart: { line: params.line, offset: 1 },
              leftFileEnd: { line: params.line, offset: 1 },
            }),
      }),

    replyToComment: (prNumber, commentId, body) => {
      // commentId is the thread ID for Azure (encoded as threadId)
      return replyToThread(
        baseUrl,
        token,
        owner,
        repo,
        prNumber,
        commentId,
        body,
      )
    },

    editIssueComment: (commentId, body) =>
      // Azure requires PR number and thread ID which we don't have here.
      // The comment node_id is encoded as "threadId:commentId".
      editComment(baseUrl, token, owner, repo, 0, 0, commentId, body),

    editReviewComment: (commentId, body) =>
      editComment(baseUrl, token, owner, repo, 0, 0, commentId, body),

    deleteReviewComment: (commentId) =>
      deleteComment(baseUrl, token, owner, repo, 0, 0, commentId),

    // -- PR state mutations -------------------------------------------------

    mergePR: (prNumber, method, commitTitle, commitMessage) => {
      const mergeOptions = mapMergeMethod(method)
      const completionOptions: Record<string, unknown> = {
        ...mergeOptions,
        deleteSourceBranch: false,
      }

      if (commitTitle) {
        completionOptions.mergeCommitMessage = commitMessage
          ? `${commitTitle}\n\n${commitMessage}`
          : commitTitle
      }

      return updatePRStatus(
        baseUrl,
        token,
        owner,
        repo,
        prNumber,
        'completed',
        completionOptions,
      )
    },

    closePR: (prNumber) =>
      updatePRStatus(baseUrl, token, owner, repo, prNumber, 'abandoned'),

    reopenPR: (prNumber) =>
      updatePRStatus(baseUrl, token, owner, repo, prNumber, 'active'),

    updatePRTitle: (prNumber, title) =>
      updatePRTitle(baseUrl, token, owner, repo, prNumber, title),

    updatePRBody: (prNumber, body) =>
      updatePRDescription(baseUrl, token, owner, repo, prNumber, body),

    requestReReview: (prNumber, reviewers) => {
      if (reviewers.length === 0) {
        return Effect.fail(
          new AzureError({
            message: 'At least one reviewer ID is required',
            status: 400,
          }),
        )
      }

      return Effect.all(
        reviewers.map((reviewerId) =>
          addReviewer(baseUrl, token, owner, repo, prNumber, reviewerId),
        ),
        { concurrency: 'unbounded' },
      ).pipe(Effect.map(() => undefined as void))
    },

    // -- Thread operations --------------------------------------------------

    resolveThread: (threadId) => {
      const { prId, threadId: tid } = decodeAzureThreadId(threadId)
      // status 2 = fixed (resolved)
      return updateThreadStatus(baseUrl, token, owner, repo, prId, tid, 2)
    },

    unresolveThread: (threadId) => {
      const { prId, threadId: tid } = decodeAzureThreadId(threadId)
      // status 1 = active (unresolved)
      return updateThreadStatus(baseUrl, token, owner, repo, prId, tid, 1)
    },

    // -- Draft operations ---------------------------------------------------

    convertToDraft: (prNodeId) => {
      const prId = parseInt(prNodeId, 10)
      if (!Number.isFinite(prId)) {
        return Effect.fail(
          new AzureError({
            message: 'Invalid Azure DevOps PR identifier',
            status: 400,
          }),
        )
      }
      return setDraftStatus(baseUrl, token, owner, repo, prId, true)
    },

    markReadyForReview: (prNodeId) => {
      const prId = parseInt(prNodeId, 10)
      if (!Number.isFinite(prId)) {
        return Effect.fail(
          new AzureError({
            message: 'Invalid Azure DevOps PR identifier',
            status: 400,
          }),
        )
      }
      return setDraftStatus(baseUrl, token, owner, repo, prId, false)
    },

    // -- Label operations (not supported for Azure DevOps) -------------------

    getLabels: () =>
      Effect.fail(
        new AzureError({ message: 'Labels are not yet supported for Azure DevOps', status: 501 }),
      ),

    setLabels: () =>
      Effect.fail(
        new AzureError({ message: 'Labels are not yet supported for Azure DevOps', status: 501 }),
      ),

    // -- User info ----------------------------------------------------------

    getCurrentUser: () =>
      Effect.map(
        fetchCurrentUser(),
        (user) => ({ login: user.displayName }),
      ),
  }
}
