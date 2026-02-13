import { Effect } from 'effect'
import type { GitHubError, NetworkError } from '../../models/errors'
import { encodeProjectPath, mutateGitLab, mutateGitLabJson, fetchGitLab } from './gitlab-helpers'

// ---------------------------------------------------------------------------
// Diff position for inline comments
// ---------------------------------------------------------------------------

export interface GitLabDiffPosition {
  readonly baseSha: string
  readonly headSha: string
  readonly startSha: string
  readonly newPath: string
  readonly newLine?: number
  readonly oldLine?: number
}

// ---------------------------------------------------------------------------
// Approve / Unapprove MR
// ---------------------------------------------------------------------------

/**
 * Approve a merge request.
 * POST /projects/:id/merge_requests/:iid/approve
 */
export function approveMR(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  iid: number,
): Effect.Effect<void, GitHubError | NetworkError> {
  const projectPath = encodeProjectPath(owner, repo)
  return mutateGitLab(
    'POST',
    baseUrl,
    `/projects/${projectPath}/merge_requests/${iid}/approve`,
    token,
    {},
  )
}

/**
 * Unapprove a merge request.
 * POST /projects/:id/merge_requests/:iid/unapprove
 */
export function unapproveMR(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  iid: number,
): Effect.Effect<void, GitHubError | NetworkError> {
  const projectPath = encodeProjectPath(owner, repo)
  return mutateGitLab(
    'POST',
    baseUrl,
    `/projects/${projectPath}/merge_requests/${iid}/unapprove`,
    token,
    {},
  )
}

// ---------------------------------------------------------------------------
// Notes (comments)
// ---------------------------------------------------------------------------

/**
 * Add a note (comment) to a merge request.
 * POST /projects/:id/merge_requests/:iid/notes
 */
export function addNote(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  iid: number,
  body: string,
): Effect.Effect<void, GitHubError | NetworkError> {
  const projectPath = encodeProjectPath(owner, repo)
  return mutateGitLab(
    'POST',
    baseUrl,
    `/projects/${projectPath}/merge_requests/${iid}/notes`,
    token,
    { body },
  )
}

/**
 * Add an inline diff comment via the discussions API.
 * POST /projects/:id/merge_requests/:iid/discussions
 *
 * GitLab uses a position object to specify where the comment goes in the diff.
 */
export function addDiffNote(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  iid: number,
  body: string,
  position: GitLabDiffPosition,
): Effect.Effect<void, GitHubError | NetworkError> {
  const projectPath = encodeProjectPath(owner, repo)
  return mutateGitLab(
    'POST',
    baseUrl,
    `/projects/${projectPath}/merge_requests/${iid}/discussions`,
    token,
    {
      body,
      position: {
        position_type: 'text',
        base_sha: position.baseSha,
        head_sha: position.headSha,
        start_sha: position.startSha,
        new_path: position.newPath,
        old_path: position.newPath,
        ...(position.newLine != null ? { new_line: position.newLine } : {}),
        ...(position.oldLine != null ? { old_line: position.oldLine } : {}),
      },
    },
  )
}

/**
 * Reply to an existing discussion thread.
 * POST /projects/:id/merge_requests/:iid/discussions/:discussion_id/notes
 */
export function replyToDiscussion(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  iid: number,
  discussionId: string,
  body: string,
): Effect.Effect<void, GitHubError | NetworkError> {
  const projectPath = encodeProjectPath(owner, repo)
  return mutateGitLab(
    'POST',
    baseUrl,
    `/projects/${projectPath}/merge_requests/${iid}/discussions/${discussionId}/notes`,
    token,
    { body },
  )
}

/**
 * Edit an existing note.
 * PUT /projects/:id/merge_requests/:iid/notes/:note_id
 */
export function editNote(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  iid: number,
  noteId: number,
  body: string,
): Effect.Effect<void, GitHubError | NetworkError> {
  const projectPath = encodeProjectPath(owner, repo)
  return mutateGitLab(
    'PUT',
    baseUrl,
    `/projects/${projectPath}/merge_requests/${iid}/notes/${noteId}`,
    token,
    { body },
  )
}

/**
 * Delete a note.
 * DELETE /projects/:id/merge_requests/:iid/notes/:note_id
 */
export function deleteNote(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  iid: number,
  noteId: number,
): Effect.Effect<void, GitHubError | NetworkError> {
  const projectPath = encodeProjectPath(owner, repo)
  return mutateGitLab(
    'DELETE',
    baseUrl,
    `/projects/${projectPath}/merge_requests/${iid}/notes/${noteId}`,
    token,
    {},
  )
}

// ---------------------------------------------------------------------------
// Merge MR
// ---------------------------------------------------------------------------

/**
 * Merge a merge request.
 * PUT /projects/:id/merge_requests/:iid/merge
 *
 * GitLab merge options:
 * - merge_commit_message: Custom merge commit message
 * - squash: Boolean — whether to squash commits
 * - squash_commit_message: Custom squash commit message
 * - should_remove_source_branch: Boolean
 */
export function mergeMR(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  iid: number,
  method: 'merge' | 'squash' | 'rebase',
  commitTitle?: string,
  commitMessage?: string,
): Effect.Effect<void, GitHubError | NetworkError> {
  const projectPath = encodeProjectPath(owner, repo)

  const body: Record<string, unknown> = {}

  if (method === 'squash') {
    body.squash = true
    if (commitTitle) {
      body.squash_commit_message = commitMessage
        ? `${commitTitle}\n\n${commitMessage}`
        : commitTitle
    }
  } else {
    body.squash = false
    if (commitTitle) {
      body.merge_commit_message = commitMessage
        ? `${commitTitle}\n\n${commitMessage}`
        : commitTitle
    }
  }

  return mutateGitLab(
    'PUT',
    baseUrl,
    `/projects/${projectPath}/merge_requests/${iid}/merge`,
    token,
    body,
  )
}

// ---------------------------------------------------------------------------
// MR state mutations (close / reopen)
// ---------------------------------------------------------------------------

/**
 * Close a merge request.
 * PUT /projects/:id/merge_requests/:iid  (state_event: 'close')
 */
export function closeMR(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  iid: number,
): Effect.Effect<void, GitHubError | NetworkError> {
  const projectPath = encodeProjectPath(owner, repo)
  return mutateGitLab(
    'PUT',
    baseUrl,
    `/projects/${projectPath}/merge_requests/${iid}`,
    token,
    { state_event: 'close' },
  )
}

/**
 * Reopen a merge request.
 * PUT /projects/:id/merge_requests/:iid  (state_event: 'reopen')
 */
export function reopenMR(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  iid: number,
): Effect.Effect<void, GitHubError | NetworkError> {
  const projectPath = encodeProjectPath(owner, repo)
  return mutateGitLab(
    'PUT',
    baseUrl,
    `/projects/${projectPath}/merge_requests/${iid}`,
    token,
    { state_event: 'reopen' },
  )
}

// ---------------------------------------------------------------------------
// MR metadata mutations (title / description)
// ---------------------------------------------------------------------------

/**
 * Update MR title.
 * PUT /projects/:id/merge_requests/:iid  (title: '...')
 */
export function updateMRTitle(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  iid: number,
  title: string,
): Effect.Effect<void, GitHubError | NetworkError> {
  const projectPath = encodeProjectPath(owner, repo)
  return mutateGitLab(
    'PUT',
    baseUrl,
    `/projects/${projectPath}/merge_requests/${iid}`,
    token,
    { title },
  )
}

/**
 * Update MR description.
 * PUT /projects/:id/merge_requests/:iid  (description: '...')
 */
export function updateMRBody(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  iid: number,
  description: string,
): Effect.Effect<void, GitHubError | NetworkError> {
  const projectPath = encodeProjectPath(owner, repo)
  return mutateGitLab(
    'PUT',
    baseUrl,
    `/projects/${projectPath}/merge_requests/${iid}`,
    token,
    { description },
  )
}

// ---------------------------------------------------------------------------
// Discussion resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a discussion thread.
 * PUT /projects/:id/merge_requests/:iid/discussions/:discussion_id  (resolved: true)
 */
export function resolveDiscussion(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  iid: number,
  discussionId: string,
): Effect.Effect<void, GitHubError | NetworkError> {
  const projectPath = encodeProjectPath(owner, repo)
  return mutateGitLab(
    'PUT',
    baseUrl,
    `/projects/${projectPath}/merge_requests/${iid}/discussions/${discussionId}`,
    token,
    { resolved: true },
  )
}

/**
 * Unresolve a discussion thread.
 * PUT /projects/:id/merge_requests/:iid/discussions/:discussion_id  (resolved: false)
 */
export function unresolveDiscussion(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  iid: number,
  discussionId: string,
): Effect.Effect<void, GitHubError | NetworkError> {
  const projectPath = encodeProjectPath(owner, repo)
  return mutateGitLab(
    'PUT',
    baseUrl,
    `/projects/${projectPath}/merge_requests/${iid}/discussions/${discussionId}`,
    token,
    { resolved: false },
  )
}

// ---------------------------------------------------------------------------
// Draft operations
// ---------------------------------------------------------------------------

/**
 * Convert MR to draft by setting the draft field.
 * PUT /projects/:id/merge_requests/:iid
 *
 * Note: GitLab API v4 supports a `draft` boolean field directly.
 * For older GitLab versions, you'd prefix the title with "Draft: ".
 * We use the `draft` field as it's the modern approach.
 */
export function convertToDraft(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  iid: number,
  currentTitle: string,
): Effect.Effect<void, GitHubError | NetworkError> {
  const projectPath = encodeProjectPath(owner, repo)
  const draftTitle = currentTitle.startsWith('Draft: ')
    ? currentTitle
    : `Draft: ${currentTitle}`

  return mutateGitLab(
    'PUT',
    baseUrl,
    `/projects/${projectPath}/merge_requests/${iid}`,
    token,
    { title: draftTitle },
  )
}

/**
 * Mark MR ready for review by removing "Draft: " prefix.
 * PUT /projects/:id/merge_requests/:iid
 */
export function markReadyForReview(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  iid: number,
  currentTitle: string,
): Effect.Effect<void, GitHubError | NetworkError> {
  const projectPath = encodeProjectPath(owner, repo)
  const readyTitle = currentTitle.startsWith('Draft: ')
    ? currentTitle.slice(7)
    : currentTitle

  return mutateGitLab(
    'PUT',
    baseUrl,
    `/projects/${projectPath}/merge_requests/${iid}`,
    token,
    { title: readyTitle },
  )
}

// ---------------------------------------------------------------------------
// Request review (add reviewers)
// ---------------------------------------------------------------------------

/**
 * Request review by updating the reviewer_ids on the MR.
 * PUT /projects/:id/merge_requests/:iid  (reviewer_ids: [...])
 *
 * Note: GitLab uses numeric user IDs, not usernames.
 * The provider layer is responsible for resolving usernames to IDs if needed.
 * For now, we accept numeric IDs as strings and parse them.
 */
export function requestReview(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  iid: number,
  reviewerIds: readonly number[],
): Effect.Effect<void, GitHubError | NetworkError> {
  const projectPath = encodeProjectPath(owner, repo)
  return mutateGitLab(
    'PUT',
    baseUrl,
    `/projects/${projectPath}/merge_requests/${iid}`,
    token,
    { reviewer_ids: [...reviewerIds] },
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
): Effect.Effect<{ readonly username: string }, GitHubError | NetworkError> {
  return fetchGitLab<{ readonly username: string }>(
    baseUrl,
    '/user',
    token,
  )
}
