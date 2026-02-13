import { Effect } from 'effect'
import { GitHubError } from '../../models/errors'
import type { ApiError } from '../CodeReviewApiTypes'
import type {
  Provider,
  ProviderConfig,
  ProviderCapabilities,
  AddDiffCommentParams,
} from './types'
import {
  approveMR,
  unapproveMR,
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

// ---------------------------------------------------------------------------
// GitLab capabilities
// ---------------------------------------------------------------------------

const GITLAB_CAPABILITIES: ProviderCapabilities = {
  supportsDraftPR: true,
  supportsReviewThreads: true,
  supportsGraphQL: true,
  supportsReactions: true,
  supportsCheckRuns: false, // GitLab uses pipelines, not check runs
  supportsMergeStrategies: ['merge', 'squash'] as const,
}

// ---------------------------------------------------------------------------
// Stub helper for unimplemented read operations
//
// Read operations (ticket #14) are being implemented by another agent.
// These stubs will be replaced once the read operations are available.
// ---------------------------------------------------------------------------

function notImplemented<A>(operation: string): Effect.Effect<A, ApiError> {
  return Effect.fail(
    new GitHubError({
      message: `GitLab read operation '${operation}' not yet implemented (see ticket #14)`,
      status: 501,
    }),
  )
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
export function decodeThreadId(threadId: string): { readonly iid: number; readonly discussionId: string } {
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

/**
 * Creates a Provider implementation for GitLab.
 *
 * Mutation operations are fully implemented. Read operations return
 * "not implemented" errors and will be provided by ticket #14.
 */
export function createGitLabProvider(config: ProviderConfig): Provider {
  const { baseUrl, token, owner, repo } = config

  return {
    type: 'gitlab',
    capabilities: GITLAB_CAPABILITIES,

    // -- PR reads (stubbed for ticket #14) ----------------------------------

    listPRs: () => notImplemented('listPRs'),
    getPR: () => notImplemented('getPR'),
    getPRFiles: () => notImplemented('getPRFiles'),
    getPRComments: () => notImplemented('getPRComments'),
    getIssueComments: () => notImplemented('getIssueComments'),
    getPRReviews: () => notImplemented('getPRReviews'),
    getPRCommits: () => notImplemented('getPRCommits'),
    getPRChecks: () => notImplemented('getPRChecks'),
    getReviewThreads: () => notImplemented('getReviewThreads'),
    getCommitDiff: () => notImplemented('getCommitDiff'),

    // -- User-scoped queries (stubbed for ticket #14) -----------------------

    getMyPRs: () => notImplemented('getMyPRs'),
    getReviewRequests: () => notImplemented('getReviewRequests'),
    getInvolvedPRs: () => notImplemented('getInvolvedPRs'),

    // -- Review mutations ---------------------------------------------------

    submitReview: (prNumber, body, event) => {
      // GitLab has no review concept. Map events to approve/unapprove + note.
      switch (event) {
        case 'APPROVE':
          return Effect.gen(function* () {
            yield* approveMR(baseUrl, token, owner, repo, prNumber)
            if (body.trim().length > 0) {
              yield* addNote(baseUrl, token, owner, repo, prNumber, body)
            }
          })
        case 'REQUEST_CHANGES':
          // GitLab has no "request changes" — post the body as a note
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
      // GitLab has no pending review concept; return a dummy ID
      Effect.succeed({ id: 0 }),

    addPendingReviewComment: (params) =>
      // GitLab has no pending reviews — post inline comment immediately
      addDiffNote(baseUrl, token, owner, repo, params.prNumber, params.body, {
        baseSha: '',
        headSha: '',
        startSha: '',
        newPath: params.path,
        newLine: params.side === 'RIGHT' ? params.line : undefined,
        oldLine: params.side === 'LEFT' ? params.line : undefined,
      }),

    submitPendingReview: (prNumber, _reviewId, body, event) => {
      // GitLab has no pending reviews; just submit the review action
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
      // GitLab has no pending reviews — nothing to discard
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
      // In GitLab, commentId is used as the discussion ID for replies.
      // The provider layer encodes discussion IDs as the commentId.
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
      // GitLab notes don't have a separate "issue comment" — we need the MR iid.
      // Use commentId as note_id with iid=0 (the caller must encode properly).
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
      // GitLab requires numeric user IDs for reviewers.
      // Parse string IDs to numbers; filter out non-numeric values.
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
      // prNodeId is expected to be "iid:currentTitle" for GitLab
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
