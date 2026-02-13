import { Effect } from 'effect'
import { z } from 'zod'
import { GitHubError } from '../../models/errors'
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
  gitlabFetchJson,
  gitlabFetchAllPages,
  buildGitLabUrl,
} from '../GitLabApiHelpers'
import {
  GitLabMergeRequestSchema,
  GitLabNoteSchema,
  GitLabDiffSchema,
  GitLabCommitSchema,
  GitLabPipelineJobSchema,
  GitLabDiscussionSchema,
  GitLabUserSchema,
  mapMergeRequestToPR,
  mapNotesToComments,
  mapNotesToIssueComments,
  mapDiffToFileChange,
  mapCommit,
  mapPipelineJobsToCheckRunsResponse,
  mapApprovalToReview,
} from '../../models/gitlab'
import type {
  GitLabMergeRequest,
  GitLabNote,
  GitLabDiff,
  GitLabCommit,
  GitLabPipelineJob,
  GitLabDiscussion,
} from '../../models/gitlab'
import { CheckRunsResponse } from '../../models/check'
import {
  approveMR,
  addNote,
  addDiffNote,
  replyToDiscussion,
  editNote,
  deleteNote,
  mergeMR,
  closeMR,
  reopenMR,
  updateMRTitle,
  updateMRBody,
  resolveDiscussion,
  unresolveDiscussion,
  convertToDraft,
  markReadyForReview,
  requestReview,
  getCurrentUser,
} from './gitlab-mutations'
import { encodeProjectPath } from './gitlab-helpers'

// ---------------------------------------------------------------------------
// GitLab capabilities
// ---------------------------------------------------------------------------

const GITLAB_CAPABILITIES: ProviderCapabilities = {
  supportsDraftPR: true,
  supportsReviewThreads: true,
  supportsGraphQL: true,
  supportsReactions: true,
  supportsCheckRuns: true,
  supportsMergeStrategies: ['merge', 'squash', 'rebase'] as const,
}

// ---------------------------------------------------------------------------
// Zod schemas for GitLab-specific response shapes
// ---------------------------------------------------------------------------

const GitLabApprovalSchema = z.object({
  approved: z.boolean(),
  approved_by: z.array(
    z.object({
      user: GitLabUserSchema,
    }),
  ),
})

const GitLabPipelineSchema = z.object({
  id: z.number(),
  status: z.string(),
  ref: z.string(),
  sha: z.string(),
  web_url: z.string(),
})

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function mapProviderStateToGitLabState(
  state?: 'open' | 'closed' | 'all',
): string {
  switch (state) {
    case 'open':
      return 'opened'
    case 'closed':
      return 'closed'
    case 'all':
      return 'all'
    default:
      return 'opened'
  }
}

function mapDiscussionToThread(
  discussion: GitLabDiscussion,
): ReviewThread | null {
  if (discussion.individual_note) return null
  const firstNote = discussion.notes[0]
  if (!firstNote || firstNote.system) return null
  if (!firstNote.resolvable) return null

  return {
    id: discussion.id,
    isResolved: firstNote.resolved ?? false,
    comments: discussion.notes.map((note) => ({
      databaseId: note.id,
    })),
  }
}

// ---------------------------------------------------------------------------
// Parse helpers with Zod validation
// ---------------------------------------------------------------------------

function parseMergeRequests(data: unknown): readonly GitLabMergeRequest[] {
  return z.array(GitLabMergeRequestSchema).parse(data)
}

function parseMergeRequest(data: unknown): GitLabMergeRequest {
  return GitLabMergeRequestSchema.parse(data)
}

function parseNotes(data: unknown): readonly GitLabNote[] {
  return z.array(GitLabNoteSchema).parse(data)
}

function parseDiffs(data: unknown): readonly GitLabDiff[] {
  return z.array(GitLabDiffSchema).parse(data)
}

function parseCommits(data: unknown): readonly GitLabCommit[] {
  return z.array(GitLabCommitSchema).parse(data)
}

function parsePipelineJobs(data: unknown): readonly GitLabPipelineJob[] {
  return z.array(GitLabPipelineJobSchema).parse(data)
}

function parseDiscussions(data: unknown): readonly GitLabDiscussion[] {
  return z.array(GitLabDiscussionSchema).parse(data)
}

// ---------------------------------------------------------------------------
// Thread ID encoding
//
// GitLab discussion resolution requires both the MR iid and discussion ID.
// We encode both into the thread ID string as "iid:discussionId" so the
// resolveThread/unresolveThread methods on the Provider interface can
// operate without needing extra context.
// ---------------------------------------------------------------------------

/**
 * Encode a GitLab thread identifier from MR iid and discussion ID.
 */
export function encodeThreadId(iid: number, discussionId: string): string {
  return `${iid}:${discussionId}`
}

/**
 * Decode a thread identifier back into MR iid and discussion ID.
 */
export function decodeThreadId(
  threadId: string,
): { readonly iid: number; readonly discussionId: string } {
  const separatorIndex = threadId.indexOf(':')
  if (separatorIndex === -1) {
    return { iid: 0, discussionId: threadId }
  }
  const iid = parseInt(threadId.slice(0, separatorIndex), 10)
  const discussionId = threadId.slice(separatorIndex + 1)
  return { iid: Number.isFinite(iid) ? iid : 0, discussionId }
}

// ---------------------------------------------------------------------------
// GitLab Provider factory
// ---------------------------------------------------------------------------

export function createGitLabProvider(config: ProviderConfig): Provider {
  const { baseUrl, token, owner, repo } = config
  const projectPath = encodeProjectPath(owner, repo)
  const projectBase = `/projects/${projectPath}`

  // Cache the current user for user-scoped queries
  let cachedUsername: string | null = null

  const fetchCurrentUsername = (): Effect.Effect<string, ApiError> =>
    cachedUsername != null
      ? Effect.succeed(cachedUsername)
      : Effect.map(
          gitlabFetchJson<unknown>('/user', baseUrl, token),
          (data) => {
            const user = GitLabUserSchema.parse(data)
            cachedUsername = user.username
            return user.username
          },
        )

  return {
    type: 'gitlab',
    capabilities: GITLAB_CAPABILITIES,

    // -- PR reads -----------------------------------------------------------

    listPRs: (params: ListPRsParams): Effect.Effect<PRListResult, ApiError> => {
      const glState = mapProviderStateToGitLabState(params.state)
      const queryParams: Record<string, string> = {
        state: glState,
        per_page: String(params.perPage ?? 30),
        page: String(params.page ?? 1),
      }

      if (params.sort) {
        queryParams.order_by = params.sort === 'popularity' ? 'popularity' : params.sort
      }
      if (params.direction) {
        queryParams.sort = params.direction
      }

      const qs = new URLSearchParams(queryParams).toString()
      const path = `${projectBase}/merge_requests?${qs}`

      return Effect.map(
        gitlabFetchJson<unknown>(path, baseUrl, token),
        (data) => ({
          items: parseMergeRequests(data).map(mapMergeRequestToPR),
        }),
      )
    },

    getPR: (number) =>
      Effect.map(
        gitlabFetchJson<unknown>(
          `${projectBase}/merge_requests/${number}`,
          baseUrl,
          token,
        ),
        (data) => mapMergeRequestToPR(parseMergeRequest(data)),
      ),

    getPRFiles: (number) =>
      Effect.map(
        gitlabFetchAllPages<unknown>(
          `${projectBase}/merge_requests/${number}/diffs`,
          baseUrl,
          token,
        ),
        (data) => parseDiffs(data).map(mapDiffToFileChange),
      ),

    getPRComments: (number) =>
      Effect.gen(function* () {
        const [notesData, mrData] = yield* Effect.all([
          gitlabFetchAllPages<unknown>(
            `${projectBase}/merge_requests/${number}/notes`,
            baseUrl,
            token,
          ),
          gitlabFetchJson<unknown>(
            `${projectBase}/merge_requests/${number}`,
            baseUrl,
            token,
          ),
        ])

        const notes = parseNotes(notesData)
        const mr = parseMergeRequest(mrData)

        // Only diff-attached notes (those with a position) are "PR comments"
        const diffNotes = notes.filter(
          (note) => !note.system && note.position != null,
        )
        return mapNotesToComments(diffNotes, mr.web_url)
      }),

    getIssueComments: (issueNumber) =>
      Effect.gen(function* () {
        const [notesData, mrData] = yield* Effect.all([
          gitlabFetchAllPages<unknown>(
            `${projectBase}/merge_requests/${issueNumber}/notes`,
            baseUrl,
            token,
          ),
          gitlabFetchJson<unknown>(
            `${projectBase}/merge_requests/${issueNumber}`,
            baseUrl,
            token,
          ),
        ])

        const notes = parseNotes(notesData)
        const mr = parseMergeRequest(mrData)

        // Non-positional, non-system notes are issue-level comments
        return mapNotesToIssueComments(notes, mr.web_url)
      }),

    getPRReviews: (number) =>
      Effect.gen(function* () {
        const [approvalData, mrData] = yield* Effect.all([
          gitlabFetchJson<unknown>(
            `${projectBase}/merge_requests/${number}/approvals`,
            baseUrl,
            token,
          ),
          gitlabFetchJson<unknown>(
            `${projectBase}/merge_requests/${number}`,
            baseUrl,
            token,
          ),
        ])

        const approvals = GitLabApprovalSchema.parse(approvalData)
        const mr = parseMergeRequest(mrData)

        return approvals.approved_by.map((entry) =>
          mapApprovalToReview(entry.user, mr.updated_at, mr.web_url),
        )
      }),

    getPRCommits: (number) =>
      Effect.map(
        gitlabFetchAllPages<unknown>(
          `${projectBase}/merge_requests/${number}/commits`,
          baseUrl,
          token,
        ),
        (data) => parseCommits(data).map((c) => mapCommit(c)),
      ),

    getPRChecks: (ref) =>
      Effect.gen(function* () {
        // GitLab: get pipelines for the ref (sha), then get jobs
        const pipelinesData = yield* gitlabFetchJson<unknown>(
          `${projectBase}/pipelines?sha=${encodeURIComponent(ref)}&per_page=1`,
          baseUrl,
          token,
        )

        const pipelines = z.array(GitLabPipelineSchema).parse(pipelinesData)

        if (pipelines.length === 0) {
          return new CheckRunsResponse({
            total_count: 0,
            check_runs: [],
          })
        }

        const pipelineId = pipelines[0]!.id
        const jobsData = yield* gitlabFetchAllPages<unknown>(
          `${projectBase}/pipelines/${pipelineId}/jobs`,
          baseUrl,
          token,
        )

        return mapPipelineJobsToCheckRunsResponse(parsePipelineJobs(jobsData))
      }),

    getReviewThreads: (prNumber) =>
      Effect.map(
        gitlabFetchAllPages<unknown>(
          `${projectBase}/merge_requests/${prNumber}/discussions`,
          baseUrl,
          token,
        ),
        (data) => {
          const discussions = parseDiscussions(data)
          return discussions
            .map(mapDiscussionToThread)
            .filter(
              (thread): thread is ReviewThread => thread != null,
            )
        },
      ),

    getCommitDiff: (sha) =>
      Effect.map(
        gitlabFetchJson<unknown>(
          `${projectBase}/repository/commits/${encodeURIComponent(sha)}/diff`,
          baseUrl,
          token,
        ),
        (data) => {
          // GitLab returns an array of diffs directly for commit diff
          const diffs = parseDiffs(Array.isArray(data) ? data : [])
          return diffs.map(mapDiffToFileChange)
        },
      ),

    // -- User-scoped queries ------------------------------------------------

    getMyPRs: (stateFilter) =>
      Effect.map(
        gitlabFetchAllPages<unknown>(
          '/merge_requests',
          baseUrl,
          token,
          {
            scope: 'created_by_me',
            state: mapProviderStateToGitLabState(stateFilter),
          },
        ),
        (data) => parseMergeRequests(data).map(mapMergeRequestToPR),
      ),

    getReviewRequests: (stateFilter) =>
      Effect.gen(function* () {
        const username = yield* fetchCurrentUsername()
        const data = yield* gitlabFetchAllPages<unknown>(
          '/merge_requests',
          baseUrl,
          token,
          {
            reviewer_username: username,
            state: mapProviderStateToGitLabState(stateFilter),
          },
        )
        return parseMergeRequests(data).map(mapMergeRequestToPR)
      }),

    getInvolvedPRs: (stateFilter) =>
      Effect.map(
        gitlabFetchAllPages<unknown>(
          '/merge_requests',
          baseUrl,
          token,
          {
            scope: 'all',
            state: mapProviderStateToGitLabState(stateFilter),
          },
        ),
        (data) => parseMergeRequests(data).map(mapMergeRequestToPR),
      ),

    // -- Review mutations ---------------------------------------------------

    submitReview: (prNumber, body, event) => {
      switch (event) {
        case 'APPROVE':
          return Effect.gen(function* () {
            yield* approveMR(baseUrl, token, owner, repo, prNumber)
            if (body.trim().length > 0) {
              yield* addNote(baseUrl, token, owner, repo, prNumber, body)
            }
          })
        case 'REQUEST_CHANGES':
          return addNote(
            baseUrl,
            token,
            owner,
            repo,
            prNumber,
            body.trim().length > 0 ? body : 'Changes requested.',
          )
        case 'COMMENT':
          return addNote(
            baseUrl,
            token,
            owner,
            repo,
            prNumber,
            body.trim().length > 0 ? body : 'Review comment.',
          )
      }
    },

    createPendingReview: () =>
      Effect.succeed({ id: 0 }),

    addPendingReviewComment: (params) =>
      addDiffNote(baseUrl, token, owner, repo, params.prNumber, params.body, {
        baseSha: '',
        headSha: '',
        startSha: '',
        newPath: params.path,
        newLine: params.side === 'RIGHT' ? params.line : undefined,
        oldLine: params.side === 'LEFT' ? params.line : undefined,
      }),

    submitPendingReview: (prNumber, _reviewId, body, event) => {
      switch (event) {
        case 'APPROVE':
          return Effect.gen(function* () {
            yield* approveMR(baseUrl, token, owner, repo, prNumber)
            if (body.trim().length > 0) {
              yield* addNote(baseUrl, token, owner, repo, prNumber, body)
            }
          })
        case 'REQUEST_CHANGES':
          return addNote(
            baseUrl,
            token,
            owner,
            repo,
            prNumber,
            body.trim().length > 0 ? body : 'Changes requested.',
          )
        case 'COMMENT':
          return body.trim().length > 0
            ? addNote(baseUrl, token, owner, repo, prNumber, body)
            : Effect.succeed(undefined as void)
      }
    },

    discardPendingReview: () =>
      Effect.succeed(undefined as void),

    // -- Comment mutations --------------------------------------------------

    addComment: (issueNumber, body) =>
      addNote(baseUrl, token, owner, repo, issueNumber, body),

    addDiffComment: (params: AddDiffCommentParams) =>
      addDiffNote(baseUrl, token, owner, repo, params.prNumber, params.body, {
        baseSha: '',
        headSha: params.commitId,
        startSha: '',
        newPath: params.path,
        newLine: params.side === 'RIGHT' ? params.line : undefined,
        oldLine: params.side === 'LEFT' ? params.line : undefined,
      }),

    replyToComment: (prNumber, commentId, body) =>
      replyToDiscussion(
        baseUrl,
        token,
        owner,
        repo,
        prNumber,
        String(commentId),
        body,
      ),

    editIssueComment: (commentId, body) =>
      editNote(baseUrl, token, owner, repo, 0, commentId, body),

    editReviewComment: (commentId, body) =>
      editNote(baseUrl, token, owner, repo, 0, commentId, body),

    deleteReviewComment: (commentId) =>
      deleteNote(baseUrl, token, owner, repo, 0, commentId),

    // -- PR state mutations -------------------------------------------------

    mergePR: (prNumber, method, commitTitle, commitMessage) =>
      mergeMR(baseUrl, token, owner, repo, prNumber, method, commitTitle, commitMessage),

    closePR: (prNumber) =>
      closeMR(baseUrl, token, owner, repo, prNumber),

    reopenPR: (prNumber) =>
      reopenMR(baseUrl, token, owner, repo, prNumber),

    updatePRTitle: (prNumber, title) =>
      updateMRTitle(baseUrl, token, owner, repo, prNumber, title),

    updatePRBody: (prNumber, body) =>
      updateMRBody(baseUrl, token, owner, repo, prNumber, body),

    requestReReview: (prNumber, reviewers) => {
      const numericIds = reviewers
        .map((r) => parseInt(r, 10))
        .filter((id) => Number.isFinite(id) && id > 0)

      if (numericIds.length === 0) {
        return Effect.fail(
          new GitHubError({
            message: 'GitLab requires numeric user IDs for reviewers',
            status: 400,
          }),
        )
      }

      return requestReview(baseUrl, token, owner, repo, prNumber, numericIds)
    },

    // -- Thread operations --------------------------------------------------

    resolveThread: (threadId) => {
      const { iid, discussionId } = decodeThreadId(threadId)
      return resolveDiscussion(baseUrl, token, owner, repo, iid, discussionId)
    },

    unresolveThread: (threadId) => {
      const { iid, discussionId } = decodeThreadId(threadId)
      return unresolveDiscussion(baseUrl, token, owner, repo, iid, discussionId)
    },

    // -- Draft operations ---------------------------------------------------

    convertToDraft: (prNodeId) => {
      const separatorIndex = prNodeId.indexOf(':')
      if (separatorIndex === -1) {
        return Effect.fail(
          new GitHubError({
            message: 'Invalid GitLab draft identifier: expected "iid:title"',
            status: 400,
          }),
        )
      }
      const iid = parseInt(prNodeId.slice(0, separatorIndex), 10)
      const title = prNodeId.slice(separatorIndex + 1)
      if (!Number.isFinite(iid)) {
        return Effect.fail(
          new GitHubError({
            message: 'Invalid GitLab draft identifier: iid is not a number',
            status: 400,
          }),
        )
      }
      return convertToDraft(baseUrl, token, owner, repo, iid, title)
    },

    markReadyForReview: (prNodeId) => {
      const separatorIndex = prNodeId.indexOf(':')
      if (separatorIndex === -1) {
        return Effect.fail(
          new GitHubError({
            message: 'Invalid GitLab draft identifier: expected "iid:title"',
            status: 400,
          }),
        )
      }
      const iid = parseInt(prNodeId.slice(0, separatorIndex), 10)
      const title = prNodeId.slice(separatorIndex + 1)
      if (!Number.isFinite(iid)) {
        return Effect.fail(
          new GitHubError({
            message: 'Invalid GitLab draft identifier: iid is not a number',
            status: 400,
          }),
        )
      }
      return markReadyForReview(baseUrl, token, owner, repo, iid, title)
    },

    // -- User info ----------------------------------------------------------

    getCurrentUser: () =>
      Effect.map(
        getCurrentUser(baseUrl, token),
        (user) => ({ login: user.username }),
      ),
  }
}
