import { Effect } from 'effect'
import type { GiteaError, NetworkError } from '../../models/errors'
import { mutateGitea, mutateGiteaJson, giteaFetchJson } from '../GiteaApiHelpers'

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

/**
 * Add a general comment to a pull request (issue-level comment).
 * POST /repos/{owner}/{repo}/issues/{index}/comments
 */
export function addComment(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  prIndex: number,
  body: string,
): Effect.Effect<void, GiteaError | NetworkError> {
  return mutateGitea(
    'POST',
    baseUrl,
    `/repos/${owner}/${repo}/issues/${prIndex}/comments`,
    token,
    { body },
  )
}

/**
 * Add an inline diff comment via a single-comment review.
 * POST /repos/{owner}/{repo}/pulls/{index}/reviews
 *
 * Gitea requires creating a review with a comment array to post inline comments.
 */
export function addInlineComment(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  prIndex: number,
  body: string,
  path: string,
  line: number,
  side: 'LEFT' | 'RIGHT',
  commitId?: string,
): Effect.Effect<void, GiteaError | NetworkError> {
  const newPosition = side === 'RIGHT' ? line : 0
  const oldPosition = side === 'LEFT' ? line : 0

  return mutateGitea(
    'POST',
    baseUrl,
    `/repos/${owner}/${repo}/pulls/${prIndex}/reviews`,
    token,
    {
      event: 'COMMENT',
      body: '',
      comments: [
        {
          path,
          body,
          new_position: newPosition,
          old_position: oldPosition,
        },
      ],
    },
  )
}

/**
 * Reply to a review comment.
 * POST /repos/{owner}/{repo}/pulls/{index}/reviews/{id}/comments
 */
export function replyToReviewComment(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  prIndex: number,
  reviewId: number,
  body: string,
): Effect.Effect<void, GiteaError | NetworkError> {
  return mutateGitea(
    'POST',
    baseUrl,
    `/repos/${owner}/${repo}/pulls/${prIndex}/reviews/${reviewId}/comments`,
    token,
    { body },
  )
}

/**
 * Edit an issue comment.
 * PATCH /repos/{owner}/{repo}/issues/comments/{id}
 */
export function editIssueComment(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  commentId: number,
  body: string,
): Effect.Effect<void, GiteaError | NetworkError> {
  return mutateGitea(
    'PATCH',
    baseUrl,
    `/repos/${owner}/${repo}/issues/comments/${commentId}`,
    token,
    { body },
  )
}

/**
 * Delete an issue comment.
 * DELETE /repos/{owner}/{repo}/issues/comments/{id}
 */
export function deleteIssueComment(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  commentId: number,
): Effect.Effect<void, GiteaError | NetworkError> {
  return mutateGitea(
    'DELETE',
    baseUrl,
    `/repos/${owner}/${repo}/issues/comments/${commentId}`,
    token,
  )
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

/**
 * Submit a review.
 * POST /repos/{owner}/{repo}/pulls/{index}/reviews
 *
 * event: "APPROVED" | "REQUEST_CHANGES" | "COMMENT"
 */
export function submitReview(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  prIndex: number,
  body: string,
  event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
): Effect.Effect<void, GiteaError | NetworkError> {
  // Gitea uses APPROVED (not APPROVE) for review submission
  const giteaEvent = event === 'APPROVE' ? 'APPROVED' : event

  return mutateGitea(
    'POST',
    baseUrl,
    `/repos/${owner}/${repo}/pulls/${prIndex}/reviews`,
    token,
    {
      body: body || '',
      event: giteaEvent,
    },
  )
}

/**
 * Create a pending review (Gitea doesn't have pending reviews natively).
 * We simulate it by returning a placeholder ID.
 */
export function createPendingReview(
  _baseUrl: string,
  _token: string,
  _owner: string,
  _repo: string,
  _prIndex: number,
): Effect.Effect<{ readonly id: number }, GiteaError | NetworkError> {
  // Gitea doesn't support pending reviews -- return a placeholder
  return Effect.succeed({ id: 0 })
}

// ---------------------------------------------------------------------------
// PR State Mutations
// ---------------------------------------------------------------------------

/**
 * Merge a pull request.
 * POST /repos/{owner}/{repo}/pulls/{index}/merge
 *
 * Gitea's merge body uses `Do` field for strategy:
 *   merge, squash, rebase, rebase-merge
 */
export function mergePR(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  prIndex: number,
  method: 'merge' | 'squash' | 'rebase',
  commitTitle?: string,
  commitMessage?: string,
): Effect.Effect<void, GiteaError | NetworkError> {
  const mergeBody: Record<string, unknown> = {
    Do: method,
  }

  if (commitTitle) {
    mergeBody.merge_message_field = commitMessage
      ? `${commitTitle}\n\n${commitMessage}`
      : commitTitle
  }

  return mutateGitea(
    'POST',
    baseUrl,
    `/repos/${owner}/${repo}/pulls/${prIndex}/merge`,
    token,
    mergeBody,
  )
}

/**
 * Close a pull request.
 * PATCH /repos/{owner}/{repo}/pulls/{index}
 */
export function closePR(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  prIndex: number,
): Effect.Effect<void, GiteaError | NetworkError> {
  return mutateGitea(
    'PATCH',
    baseUrl,
    `/repos/${owner}/${repo}/pulls/${prIndex}`,
    token,
    { state: 'closed' },
  )
}

/**
 * Reopen a pull request.
 * PATCH /repos/{owner}/{repo}/pulls/{index}
 */
export function reopenPR(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  prIndex: number,
): Effect.Effect<void, GiteaError | NetworkError> {
  return mutateGitea(
    'PATCH',
    baseUrl,
    `/repos/${owner}/${repo}/pulls/${prIndex}`,
    token,
    { state: 'open' },
  )
}

/**
 * Update a pull request title.
 * PATCH /repos/{owner}/{repo}/pulls/{index}
 */
export function updatePRTitle(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  prIndex: number,
  title: string,
): Effect.Effect<void, GiteaError | NetworkError> {
  return mutateGitea(
    'PATCH',
    baseUrl,
    `/repos/${owner}/${repo}/pulls/${prIndex}`,
    token,
    { title },
  )
}

/**
 * Update a pull request body/description.
 * PATCH /repos/{owner}/{repo}/pulls/{index}
 */
export function updatePRBody(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  prIndex: number,
  body: string,
): Effect.Effect<void, GiteaError | NetworkError> {
  return mutateGitea(
    'PATCH',
    baseUrl,
    `/repos/${owner}/${repo}/pulls/${prIndex}`,
    token,
    { body },
  )
}

/**
 * Request re-review from specific reviewers.
 * POST /repos/{owner}/{repo}/pulls/{index}/requested_reviewers
 */
export function requestReReview(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  prIndex: number,
  reviewers: readonly string[],
): Effect.Effect<void, GiteaError | NetworkError> {
  return mutateGitea(
    'POST',
    baseUrl,
    `/repos/${owner}/${repo}/pulls/${prIndex}/requested_reviewers`,
    token,
    { reviewers: [...reviewers] },
  )
}

// ---------------------------------------------------------------------------
// Current user
// ---------------------------------------------------------------------------

/**
 * Get the currently authenticated user.
 * GET /user
 */
export function getCurrentUser(
  baseUrl: string,
  token: string,
): Effect.Effect<
  { readonly login: string; readonly id: number },
  GiteaError | NetworkError
> {
  return giteaFetchJson<{ readonly login: string; readonly id: number }>(
    '/user',
    baseUrl,
    token,
  )
}
