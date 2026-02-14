import { Effect } from 'effect'
import type { BitbucketError, NetworkError } from '../../models/errors'
import { mutateBitbucket, mutateBitbucketJson, fetchBitbucket } from './bitbucket-helpers'

// ---------------------------------------------------------------------------
// Approve / Unapprove PR
// ---------------------------------------------------------------------------

/**
 * Approve a pull request.
 * POST /repositories/{workspace}/{repo_slug}/pullrequests/{id}/approve
 */
export function approvePR(
  baseUrl: string,
  token: string,
  workspace: string,
  repoSlug: string,
  prId: number,
): Effect.Effect<void, BitbucketError | NetworkError> {
  return mutateBitbucket(
    'POST',
    baseUrl,
    `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/approve`,
    token,
  )
}

/**
 * Unapprove a pull request.
 * DELETE /repositories/{workspace}/{repo_slug}/pullrequests/{id}/approve
 */
export function unapprovePR(
  baseUrl: string,
  token: string,
  workspace: string,
  repoSlug: string,
  prId: number,
): Effect.Effect<void, BitbucketError | NetworkError> {
  return mutateBitbucket(
    'DELETE',
    baseUrl,
    `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/approve`,
    token,
  )
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

/**
 * Add a general comment to a pull request.
 * POST /repositories/{workspace}/{repo_slug}/pullrequests/{id}/comments
 */
export function addComment(
  baseUrl: string,
  token: string,
  workspace: string,
  repoSlug: string,
  prId: number,
  body: string,
): Effect.Effect<void, BitbucketError | NetworkError> {
  return mutateBitbucket(
    'POST',
    baseUrl,
    `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/comments`,
    token,
    { content: { raw: body } },
  )
}

/**
 * Add an inline diff comment to a pull request.
 * POST /repositories/{workspace}/{repo_slug}/pullrequests/{id}/comments
 *
 * Bitbucket inline comments use `inline.path`, `inline.from` (old line),
 * and `inline.to` (new line) to position the comment in the diff.
 */
export function addInlineComment(
  baseUrl: string,
  token: string,
  workspace: string,
  repoSlug: string,
  prId: number,
  body: string,
  path: string,
  line: number,
  side: 'LEFT' | 'RIGHT',
): Effect.Effect<void, BitbucketError | NetworkError> {
  const inline: Record<string, unknown> = { path }
  if (side === 'RIGHT') {
    inline.to = line
  } else {
    inline.from = line
  }

  return mutateBitbucket(
    'POST',
    baseUrl,
    `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/comments`,
    token,
    {
      content: { raw: body },
      inline,
    },
  )
}

/**
 * Reply to an existing comment.
 * POST /repositories/{workspace}/{repo_slug}/pullrequests/{id}/comments
 *
 * Bitbucket uses `parent.id` to indicate a reply to a specific comment.
 */
export function replyToComment(
  baseUrl: string,
  token: string,
  workspace: string,
  repoSlug: string,
  prId: number,
  parentCommentId: number,
  body: string,
): Effect.Effect<void, BitbucketError | NetworkError> {
  return mutateBitbucket(
    'POST',
    baseUrl,
    `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/comments`,
    token,
    {
      content: { raw: body },
      parent: { id: parentCommentId },
    },
  )
}

/**
 * Update an existing comment.
 * PUT /repositories/{workspace}/{repo_slug}/pullrequests/{id}/comments/{comment_id}
 */
export function editComment(
  baseUrl: string,
  token: string,
  workspace: string,
  repoSlug: string,
  prId: number,
  commentId: number,
  body: string,
): Effect.Effect<void, BitbucketError | NetworkError> {
  return mutateBitbucket(
    'PUT',
    baseUrl,
    `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/comments/${commentId}`,
    token,
    { content: { raw: body } },
  )
}

/**
 * Delete a comment.
 * DELETE /repositories/{workspace}/{repo_slug}/pullrequests/{id}/comments/{comment_id}
 */
export function deleteComment(
  baseUrl: string,
  token: string,
  workspace: string,
  repoSlug: string,
  prId: number,
  commentId: number,
): Effect.Effect<void, BitbucketError | NetworkError> {
  return mutateBitbucket(
    'DELETE',
    baseUrl,
    `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/comments/${commentId}`,
    token,
  )
}

// ---------------------------------------------------------------------------
// Merge PR
// ---------------------------------------------------------------------------

/**
 * Merge strategy mapping from normalized names to Bitbucket API values.
 *
 * Bitbucket supports: merge_commit, squash, fast_forward
 * Provider interface uses: merge, squash, rebase
 *
 * Mapping:
 * - merge -> merge_commit
 * - squash -> squash
 * - rebase -> fast_forward (closest equivalent)
 */
function mapMergeStrategy(
  method: 'merge' | 'squash' | 'rebase',
): string {
  switch (method) {
    case 'merge':
      return 'merge_commit'
    case 'squash':
      return 'squash'
    case 'rebase':
      return 'fast_forward'
  }
}

/**
 * Merge a pull request.
 * POST /repositories/{workspace}/{repo_slug}/pullrequests/{id}/merge
 */
export function mergePR(
  baseUrl: string,
  token: string,
  workspace: string,
  repoSlug: string,
  prId: number,
  method: 'merge' | 'squash' | 'rebase',
  commitTitle?: string,
  commitMessage?: string,
): Effect.Effect<void, BitbucketError | NetworkError> {
  const body: Record<string, unknown> = {
    merge_strategy: mapMergeStrategy(method),
  }

  if (commitTitle) {
    body.message = commitMessage
      ? `${commitTitle}\n\n${commitMessage}`
      : commitTitle
  }

  return mutateBitbucket(
    'POST',
    baseUrl,
    `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/merge`,
    token,
    body,
  )
}

// ---------------------------------------------------------------------------
// PR state mutations
// ---------------------------------------------------------------------------

/**
 * Decline (close) a pull request.
 * POST /repositories/{workspace}/{repo_slug}/pullrequests/{id}/decline
 *
 * Note: Bitbucket uses "decline" instead of "close".
 * Declined PRs cannot be reopened -- a new PR must be created instead.
 */
export function declinePR(
  baseUrl: string,
  token: string,
  workspace: string,
  repoSlug: string,
  prId: number,
): Effect.Effect<void, BitbucketError | NetworkError> {
  return mutateBitbucket(
    'POST',
    baseUrl,
    `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/decline`,
    token,
  )
}

// ---------------------------------------------------------------------------
// PR metadata mutations
// ---------------------------------------------------------------------------

/**
 * Update a pull request's title.
 * PUT /repositories/{workspace}/{repo_slug}/pullrequests/{id}
 */
export function updatePRTitle(
  baseUrl: string,
  token: string,
  workspace: string,
  repoSlug: string,
  prId: number,
  title: string,
): Effect.Effect<void, BitbucketError | NetworkError> {
  return mutateBitbucket(
    'PUT',
    baseUrl,
    `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}`,
    token,
    { title },
  )
}

/**
 * Update a pull request's description.
 * PUT /repositories/{workspace}/{repo_slug}/pullrequests/{id}
 */
export function updatePRDescription(
  baseUrl: string,
  token: string,
  workspace: string,
  repoSlug: string,
  prId: number,
  description: string,
): Effect.Effect<void, BitbucketError | NetworkError> {
  return mutateBitbucket(
    'PUT',
    baseUrl,
    `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}`,
    token,
    { description },
  )
}

/**
 * Update reviewers on a pull request.
 * PUT /repositories/{workspace}/{repo_slug}/pullrequests/{id}
 *
 * Bitbucket expects reviewers as an array of user objects with uuid fields.
 */
export function updateReviewers(
  baseUrl: string,
  token: string,
  workspace: string,
  repoSlug: string,
  prId: number,
  reviewerUuids: readonly string[],
): Effect.Effect<void, BitbucketError | NetworkError> {
  const reviewers = reviewerUuids.map((uuid) => ({ uuid }))
  return mutateBitbucket(
    'PUT',
    baseUrl,
    `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}`,
    token,
    { reviewers },
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
  { readonly username: string; readonly uuid: string; readonly display_name: string },
  BitbucketError | NetworkError
> {
  return fetchBitbucket<{
    readonly username: string
    readonly uuid: string
    readonly display_name: string
  }>(baseUrl, '/user', token)
}
