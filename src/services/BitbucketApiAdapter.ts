import { Effect } from 'effect'
import { createBitbucketProvider } from './providers/bitbucket'
import { getDefaultBaseUrl } from './providers/types'
import type { Provider } from './providers/types'
import { getTokenForProvider } from './Auth'
import { BitbucketError } from '../models/errors'
import type { ApiError, CodeReviewApiService } from './CodeReviewApiTypes'

const CROSS_REPO_NOT_SUPPORTED = new BitbucketError({
  message:
    'Cross-repo PR queries are not supported through this adapter -- use the multi-provider Bitbucket fetch hook instead.',
  status: 501,
})

const THREAD_RESOLUTION_NOT_SUPPORTED = new BitbucketError({
  message: 'Bitbucket does not support thread resolution',
  status: 400,
})

const DRAFT_NOT_SUPPORTED = new BitbucketError({
  message: 'Bitbucket does not support draft pull requests',
  status: 400,
})

function withBitbucketProvider<A>(
  owner: string,
  repo: string,
  fn: (provider: Provider) => Effect.Effect<A, ApiError>,
): Effect.Effect<A, ApiError> {
  return Effect.gen(function* () {
    const token = yield* getTokenForProvider('bitbucket')
    const provider = createBitbucketProvider({
      type: 'bitbucket',
      baseUrl: getDefaultBaseUrl('bitbucket'),
      token,
      owner,
      repo,
    })
    return yield* fn(provider)
  })
}

/**
 * Adapts `createBitbucketProvider` (which bakes owner/repo into construction,
 * per `Provider`'s shape) into `CodeReviewApiService`'s shape (owner/repo as
 * explicit per-call params), so Bitbucket PR-detail fetches and mutations can
 * reuse the same call sites the GitHub-backed CodeReviewApi already uses. A
 * fresh Provider instance is constructed per call -- `createBitbucketProvider`
 * is stateless, so this has no persistent-instance cost.
 *
 * Cross-repo user-scoped queries (getMyPRs/getReviewRequests/getInvolvedPRs)
 * are deliberately NOT implemented here: Bitbucket Cloud has no equivalent
 * cross-repo search API, so those are handled separately by fanning out over
 * the user's bookmarked repos (see useBitbucketPRs.ts). Calling them on this
 * adapter fails clearly instead of silently returning an empty list.
 */
export function createBitbucketApiAdapter(): CodeReviewApiService {
  return {
    listPRs: (owner, repo, options) =>
      withBitbucketProvider(owner, repo, (p) =>
        Effect.map(p.listPRs(options ?? {}), (result) => result.items),
      ),

    getPR: (owner, repo, number) =>
      withBitbucketProvider(owner, repo, (p) => p.getPR(number)),

    getPRFiles: (owner, repo, number) =>
      withBitbucketProvider(owner, repo, (p) => p.getPRFiles(number)),

    getPRFilesPage: (owner, repo, number, page) =>
      withBitbucketProvider(owner, repo, (p) => p.getPRFilesPage(number, page)),

    getFileDiff: (owner, repo, number, filename) =>
      withBitbucketProvider(owner, repo, (p) =>
        p.getFileDiff(number, filename),
      ),

    getPRComments: (owner, repo, number) =>
      withBitbucketProvider(owner, repo, (p) => p.getPRComments(number)),

    getIssueComments: (owner, repo, issueNumber) =>
      withBitbucketProvider(owner, repo, (p) =>
        p.getIssueComments(issueNumber),
      ),

    getPRReviews: (owner, repo, number) =>
      withBitbucketProvider(owner, repo, (p) => p.getPRReviews(number)),

    getPRCommits: (owner, repo, number) =>
      withBitbucketProvider(owner, repo, (p) => p.getPRCommits(number)),

    getPRChecks: (owner, repo, ref) =>
      withBitbucketProvider(owner, repo, (p) => p.getPRChecks(ref)),

    getReviewThreads: (owner, repo, prNumber) =>
      withBitbucketProvider(owner, repo, (p) => p.getReviewThreads(prNumber)),

    getCommitDiff: (owner, repo, sha) =>
      withBitbucketProvider(owner, repo, (p) => p.getCommitDiff(sha)),

    // Cross-repo, user-scoped -- see useBitbucketPRs.ts instead.
    getMyPRs: () => Effect.fail(CROSS_REPO_NOT_SUPPORTED),
    getReviewRequests: () => Effect.fail(CROSS_REPO_NOT_SUPPORTED),
    getInvolvedPRs: () => Effect.fail(CROSS_REPO_NOT_SUPPORTED),

    submitReview: (owner, repo, prNumber, body, event) =>
      withBitbucketProvider(owner, repo, (p) =>
        p.submitReview(prNumber, body, event),
      ),

    createPendingReview: (owner, repo, prNumber) =>
      withBitbucketProvider(owner, repo, (p) =>
        p.createPendingReview(prNumber),
      ),

    addPendingReviewComment: (
      owner,
      repo,
      prNumber,
      reviewId,
      body,
      path,
      line,
      side,
      startLine,
      startSide,
    ) =>
      withBitbucketProvider(owner, repo, (p) =>
        p.addPendingReviewComment({
          prNumber,
          reviewId,
          body,
          path,
          line,
          side,
          startLine,
          startSide,
        }),
      ),

    submitPendingReview: (owner, repo, prNumber, reviewId, body, event) =>
      withBitbucketProvider(owner, repo, (p) =>
        p.submitPendingReview(prNumber, reviewId, body, event),
      ),

    discardPendingReview: (owner, repo, prNumber, reviewId) =>
      withBitbucketProvider(owner, repo, (p) =>
        p.discardPendingReview(prNumber, reviewId),
      ),

    addComment: (owner, repo, issueNumber, body) =>
      withBitbucketProvider(owner, repo, (p) =>
        p.addComment(issueNumber, body),
      ),

    addDiffComment: (
      owner,
      repo,
      prNumber,
      body,
      commitId,
      path,
      line,
      side,
      startLine,
      startSide,
    ) =>
      withBitbucketProvider(owner, repo, (p) =>
        p.addDiffComment({
          prNumber,
          body,
          commitId,
          path,
          line,
          side,
          startLine,
          startSide,
        }),
      ),

    // Provider.replyToComment takes (prNumber, commentId, body) -- note the
    // body/commentId order differs from CodeReviewApiService's (..., body,
    // inReplyTo).
    replyToComment: (owner, repo, prNumber, body, inReplyTo) =>
      withBitbucketProvider(owner, repo, (p) =>
        p.replyToComment(prNumber, inReplyTo, body),
      ),

    editIssueComment: (owner, repo, commentId, body) =>
      withBitbucketProvider(owner, repo, (p) =>
        p.editIssueComment(commentId, body),
      ),

    editReviewComment: (owner, repo, commentId, body) =>
      withBitbucketProvider(owner, repo, (p) =>
        p.editReviewComment(commentId, body),
      ),

    deleteReviewComment: (owner, repo, commentId) =>
      withBitbucketProvider(owner, repo, (p) =>
        p.deleteReviewComment(commentId),
      ),

    mergePR: (owner, repo, prNumber, mergeMethod, commitTitle, commitMessage) =>
      withBitbucketProvider(owner, repo, (p) =>
        p.mergePR(prNumber, mergeMethod, commitTitle, commitMessage),
      ),

    closePR: (owner, repo, prNumber) =>
      withBitbucketProvider(owner, repo, (p) => p.closePR(prNumber)),

    reopenPR: (owner, repo, prNumber) =>
      withBitbucketProvider(owner, repo, (p) => p.reopenPR(prNumber)),

    updatePRTitle: (owner, repo, prNumber, title) =>
      withBitbucketProvider(owner, repo, (p) =>
        p.updatePRTitle(prNumber, title),
      ),

    updatePRBody: (owner, repo, prNumber, body) =>
      withBitbucketProvider(owner, repo, (p) => p.updatePRBody(prNumber, body)),

    requestReReview: (owner, repo, prNumber, reviewers) =>
      withBitbucketProvider(owner, repo, (p) =>
        p.requestReReview(prNumber, reviewers),
      ),

    // Neither takes owner/repo, and Bitbucket rejects both regardless of
    // repo context -- no provider construction needed.
    resolveThread: () => Effect.fail(THREAD_RESOLUTION_NOT_SUPPORTED),
    unresolveThread: () => Effect.fail(THREAD_RESOLUTION_NOT_SUPPORTED),

    convertToDraft: () => Effect.fail(DRAFT_NOT_SUPPORTED),
    markReadyForReview: () => Effect.fail(DRAFT_NOT_SUPPORTED),

    getLabels: (owner, repo) =>
      withBitbucketProvider(owner, repo, (p) => p.getLabels()),

    setLabels: (owner, repo, prNumber, labels) =>
      withBitbucketProvider(owner, repo, (p) => p.setLabels(prNumber, labels)),

    createPR: (owner, repo, title, body, baseBranch, headBranch, draft) =>
      withBitbucketProvider(owner, repo, (p) =>
        p.createPR({ title, body, baseBranch, headBranch, draft }),
      ),

    getCollaborators: (owner, repo) =>
      withBitbucketProvider(owner, repo, (p) => p.getCollaborators()),

    updateAssignees: (owner, repo, prNumber, assignees) =>
      withBitbucketProvider(owner, repo, (p) =>
        p.updateAssignees(prNumber, assignees),
      ),

    addReaction: (owner, repo, commentId, reaction, commentType) =>
      withBitbucketProvider(owner, repo, (p) =>
        p.addReaction(commentId, reaction, commentType),
      ),

    // Doesn't need owner/repo -- Bitbucket's getCurrentUser only uses
    // baseUrl/token -- so an empty repo context is safe here.
    getCurrentUser: () =>
      withBitbucketProvider('', '', (p) => p.getCurrentUser()),
  }
}
