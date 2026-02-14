import { Effect } from 'effect'
import { GitHubError } from '../../models/errors'
import type { CodeReviewApiService, ApiError } from '../CodeReviewApiTypes'
import type {
  Provider,
  ProviderConfig,
  ProviderCapabilities,
  ListPRsParams,
  PRListResult,
  AddDiffCommentParams,
  AddPendingReviewCommentParams,
  CreatePRParams,
} from './types'

// ---------------------------------------------------------------------------
// GitHub capabilities
// ---------------------------------------------------------------------------

const GITHUB_CAPABILITIES: ProviderCapabilities = {
  supportsDraftPR: true,
  supportsReviewThreads: true,
  supportsGraphQL: true,
  supportsReactions: true,
  supportsCheckRuns: true,
  supportsLabels: true,
  supportsAssignees: true,
  supportsMergeStrategies: ['merge', 'squash', 'rebase'] as const,
}

// ---------------------------------------------------------------------------
// GitHub Provider factory
// ---------------------------------------------------------------------------

/**
 * Creates a Provider that delegates to an existing CodeReviewApiService.
 *
 * This adapter wraps the current service-based API with the provider
 * interface, threading `owner` and `repo` from the ProviderConfig
 * into every call so callers don't need to repeat them.
 */
export function createGitHubProvider(
  config: ProviderConfig,
  service: CodeReviewApiService,
): Provider {
  const { owner, repo } = config

  return {
    type: 'github',
    capabilities: GITHUB_CAPABILITIES,

    // -- PR reads -----------------------------------------------------------

    listPRs: (params: ListPRsParams): Effect.Effect<PRListResult, ApiError> =>
      Effect.map(
        service.listPRs(owner, repo, {
          state: params.state,
          sort: params.sort,
          direction: params.direction,
          perPage: params.perPage,
          page: params.page,
        }),
        (items) => ({ items }),
      ),

    getPR: (number) => service.getPR(owner, repo, number),

    getPRFiles: (number) => service.getPRFiles(owner, repo, number),

    getPRComments: (number) => service.getPRComments(owner, repo, number),

    getIssueComments: (issueNumber) => service.getIssueComments(owner, repo, issueNumber),

    getPRReviews: (number) => service.getPRReviews(owner, repo, number),

    getPRCommits: (number) => service.getPRCommits(owner, repo, number),

    getPRChecks: (ref) => service.getPRChecks(owner, repo, ref),

    getReviewThreads: (prNumber) => service.getReviewThreads(owner, repo, prNumber),

    getCommitDiff: (sha) => service.getCommitDiff(owner, repo, sha),

    // -- User-scoped queries ------------------------------------------------

    getMyPRs: (stateFilter) => service.getMyPRs(stateFilter),

    getReviewRequests: (stateFilter) => service.getReviewRequests(stateFilter),

    getInvolvedPRs: (stateFilter) => service.getInvolvedPRs(stateFilter),

    // -- Review mutations ---------------------------------------------------

    submitReview: (prNumber, body, event) =>
      service.submitReview(owner, repo, prNumber, body, event),

    createPendingReview: (prNumber) =>
      service.createPendingReview(owner, repo, prNumber),

    addPendingReviewComment: (params: AddPendingReviewCommentParams) =>
      service.addPendingReviewComment(
        owner,
        repo,
        params.prNumber,
        params.reviewId,
        params.body,
        params.path,
        params.line,
        params.side,
        params.startLine,
        params.startSide,
      ),

    submitPendingReview: (prNumber, reviewId, body, event) =>
      service.submitPendingReview(owner, repo, prNumber, reviewId, body, event),

    discardPendingReview: (prNumber, reviewId) =>
      service.discardPendingReview(owner, repo, prNumber, reviewId),

    // -- Comment mutations --------------------------------------------------

    addComment: (issueNumber, body) =>
      service.addComment(owner, repo, issueNumber, body),

    addDiffComment: (params: AddDiffCommentParams) =>
      service.addDiffComment(
        owner,
        repo,
        params.prNumber,
        params.body,
        params.commitId,
        params.path,
        params.line,
        params.side,
        params.startLine,
        params.startSide,
      ),

    replyToComment: (prNumber, commentId, body) =>
      service.replyToComment(owner, repo, prNumber, body, commentId),

    editIssueComment: (commentId, body) =>
      service.editIssueComment(owner, repo, commentId, body),

    editReviewComment: (commentId, body) =>
      service.editReviewComment(owner, repo, commentId, body),

    deleteReviewComment: (commentId) =>
      service.deleteReviewComment(owner, repo, commentId),

    // -- PR state mutations -------------------------------------------------

    mergePR: (prNumber, method, commitTitle, commitMessage) =>
      service.mergePR(owner, repo, prNumber, method, commitTitle, commitMessage),

    closePR: (prNumber) => service.closePR(owner, repo, prNumber),

    reopenPR: (prNumber) => service.reopenPR(owner, repo, prNumber),

    updatePRTitle: (prNumber, title) =>
      service.updatePRTitle(owner, repo, prNumber, title),

    updatePRBody: (prNumber, body) =>
      service.updatePRBody(owner, repo, prNumber, body),

    requestReReview: (prNumber, reviewers) =>
      service.requestReReview(owner, repo, prNumber, reviewers),

    // -- Thread operations --------------------------------------------------

    resolveThread: (threadId) => service.resolveThread(threadId),

    unresolveThread: (threadId) => service.unresolveThread(threadId),

    // -- Draft operations ---------------------------------------------------

    convertToDraft: (prNodeId) => service.convertToDraft(prNodeId),

    markReadyForReview: (prNodeId) => service.markReadyForReview(prNodeId),

    // -- PR creation --------------------------------------------------------

    createPR: (params: CreatePRParams) =>
      service.createPR(
        owner,
        repo,
        params.title,
        params.body,
        params.baseBranch,
        params.headBranch,
        params.draft,
      ),

    // -- Label operations ---------------------------------------------------

    getLabels: () => service.getLabels(owner, repo),

    setLabels: (prNumber, labels) => service.setLabels(owner, repo, prNumber, labels),

    // -- Assignee operations ------------------------------------------------

    getCollaborators: () => service.getCollaborators(owner, repo),

    updateAssignees: (prNumber, assignees) => service.updateAssignees(owner, repo, prNumber, assignees),

    // -- User info ----------------------------------------------------------

    getCurrentUser: () => service.getCurrentUser(),
  }
}

/**
 * Create a no-op provider that fails all operations.
 * Used as a placeholder for providers not yet implemented.
 */
export function createUnsupportedProvider(type: string): Provider {
  const fail = <A>(): Effect.Effect<A, ApiError> =>
    Effect.fail(
      new GitHubError({
        message: `Provider '${type}' is not yet supported`,
        status: 501,
      }),
    )

  return {
    type: type as Provider['type'],
    capabilities: {
      supportsDraftPR: false,
      supportsReviewThreads: false,
      supportsGraphQL: false,
      supportsReactions: false,
      supportsCheckRuns: false,
      supportsLabels: false,
      supportsAssignees: false,
      supportsMergeStrategies: [],
    },
    listPRs: fail,
    getPR: fail,
    getPRFiles: fail,
    getPRComments: fail,
    getIssueComments: fail,
    getPRReviews: fail,
    getPRCommits: fail,
    getPRChecks: fail,
    getReviewThreads: fail,
    getCommitDiff: fail,
    getMyPRs: fail,
    getReviewRequests: fail,
    getInvolvedPRs: fail,
    submitReview: fail,
    createPendingReview: fail,
    addPendingReviewComment: fail,
    submitPendingReview: fail,
    discardPendingReview: fail,
    addComment: fail,
    addDiffComment: fail,
    replyToComment: fail,
    editIssueComment: fail,
    editReviewComment: fail,
    deleteReviewComment: fail,
    mergePR: fail,
    closePR: fail,
    reopenPR: fail,
    updatePRTitle: fail,
    updatePRBody: fail,
    requestReReview: fail,
    resolveThread: fail,
    unresolveThread: fail,
    convertToDraft: fail,
    markReadyForReview: fail,
    createPR: fail,
    getLabels: fail,
    setLabels: fail,
    getCollaborators: fail,
    updateAssignees: fail,
    getCurrentUser: fail,
  }
}
