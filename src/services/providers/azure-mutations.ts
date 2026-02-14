import { Effect } from 'effect'
import type { AzureError, NetworkError } from '../../models/errors'
import { mutateAzure, mutateAzureJson, fetchAzure, parseAzureOwner } from './azure-helpers'

// ---------------------------------------------------------------------------
// Azure DevOps API path builder
// ---------------------------------------------------------------------------

function gitApiBase(baseUrl: string, owner: string, repo: string): string {
  const { org, project } = parseAzureOwner(owner)
  return `/${org}/${project}/_apis/git/repositories/${repo}`
}

function buildApiBase(baseUrl: string, owner: string): string {
  const { org, project } = parseAzureOwner(owner)
  return `/${org}/${project}/_apis/build`
}

// ---------------------------------------------------------------------------
// Vote on PR (reviewer feedback)
// ---------------------------------------------------------------------------

/**
 * Cast a vote on a pull request.
 * PUT /{org}/{project}/_apis/git/repositories/{repo}/pullrequests/{id}/reviewers/{reviewerId}
 *
 * Azure DevOps vote values:
 *  10 = Approve
 *   5 = Approve with suggestions
 *   0 = No vote / Reset
 *  -5 = Wait for author
 * -10 = Reject
 */
export function votePR(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  prId: number,
  reviewerId: string,
  vote: number,
): Effect.Effect<void, AzureError | NetworkError> {
  const repoBase = gitApiBase(baseUrl, owner, repo)
  return mutateAzure(
    'PUT',
    baseUrl,
    `${repoBase}/pullrequests/${prId}/reviewers/${reviewerId}`,
    token,
    { vote },
  )
}

// ---------------------------------------------------------------------------
// Thread operations (comments)
// ---------------------------------------------------------------------------

/**
 * Create a new comment thread on a PR.
 * POST /{org}/{project}/_apis/git/repositories/{repo}/pullrequests/{id}/threads
 */
export function createThread(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  prId: number,
  body: string,
  threadContext?: {
    readonly filePath: string
    readonly rightFileStart?: { readonly line: number; readonly offset: number }
    readonly rightFileEnd?: { readonly line: number; readonly offset: number }
    readonly leftFileStart?: { readonly line: number; readonly offset: number }
    readonly leftFileEnd?: { readonly line: number; readonly offset: number }
  },
): Effect.Effect<void, AzureError | NetworkError> {
  const repoBase = gitApiBase(baseUrl, owner, repo)
  const payload: Record<string, unknown> = {
    comments: [
      {
        parentCommentId: 0,
        content: body,
        commentType: 1,
      },
    ],
    status: 1, // active
  }

  if (threadContext) {
    payload.threadContext = threadContext
  }

  return mutateAzure(
    'POST',
    baseUrl,
    `${repoBase}/pullrequests/${prId}/threads`,
    token,
    payload,
  )
}

/**
 * Reply to an existing comment thread.
 * POST /{org}/{project}/_apis/git/repositories/{repo}/pullrequests/{id}/threads/{threadId}/comments
 */
export function replyToThread(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  prId: number,
  threadId: number,
  body: string,
): Effect.Effect<void, AzureError | NetworkError> {
  const repoBase = gitApiBase(baseUrl, owner, repo)
  return mutateAzure(
    'POST',
    baseUrl,
    `${repoBase}/pullrequests/${prId}/threads/${threadId}/comments`,
    token,
    {
      content: body,
      parentCommentId: 0,
      commentType: 1,
    },
  )
}

/**
 * Update a comment in a thread.
 * PATCH /{org}/{project}/_apis/git/repositories/{repo}/pullrequests/{id}/threads/{threadId}/comments/{commentId}
 */
export function editComment(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  prId: number,
  threadId: number,
  commentId: number,
  body: string,
): Effect.Effect<void, AzureError | NetworkError> {
  const repoBase = gitApiBase(baseUrl, owner, repo)
  return mutateAzure(
    'PATCH',
    baseUrl,
    `${repoBase}/pullrequests/${prId}/threads/${threadId}/comments/${commentId}`,
    token,
    { content: body },
  )
}

/**
 * Delete a comment in a thread (soft delete).
 * DELETE /{org}/{project}/_apis/git/repositories/{repo}/pullrequests/{id}/threads/{threadId}/comments/{commentId}
 */
export function deleteComment(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  prId: number,
  threadId: number,
  commentId: number,
): Effect.Effect<void, AzureError | NetworkError> {
  const repoBase = gitApiBase(baseUrl, owner, repo)
  return mutateAzure(
    'DELETE',
    baseUrl,
    `${repoBase}/pullrequests/${prId}/threads/${threadId}/comments/${commentId}`,
    token,
  )
}

// ---------------------------------------------------------------------------
// Thread resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a thread by updating its status.
 * PATCH /{org}/{project}/_apis/git/repositories/{repo}/pullrequests/{id}/threads/{threadId}
 *
 * Status values: 1=active, 2=fixed, 3=wontFix, 4=closed, 5=byDesign, 6=pending
 */
export function updateThreadStatus(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  prId: number,
  threadId: number,
  status: number,
): Effect.Effect<void, AzureError | NetworkError> {
  const repoBase = gitApiBase(baseUrl, owner, repo)
  return mutateAzure(
    'PATCH',
    baseUrl,
    `${repoBase}/pullrequests/${prId}/threads/${threadId}`,
    token,
    { status },
  )
}

// ---------------------------------------------------------------------------
// PR state mutations
// ---------------------------------------------------------------------------

/**
 * Update PR status (complete, abandon, reactivate).
 * PATCH /{org}/{project}/_apis/git/repositories/{repo}/pullrequests/{id}
 */
export function updatePRStatus(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  prId: number,
  status: 'completed' | 'abandoned' | 'active',
  completionOptions?: Record<string, unknown>,
  lastMergeSourceCommitId?: string,
): Effect.Effect<void, AzureError | NetworkError> {
  const repoBase = gitApiBase(baseUrl, owner, repo)
  const payload: Record<string, unknown> = { status }

  if (completionOptions) {
    payload.completionOptions = completionOptions
  }

  if (lastMergeSourceCommitId) {
    payload.lastMergeSourceCommit = { commitId: lastMergeSourceCommitId }
  }

  return mutateAzure(
    'PATCH',
    baseUrl,
    `${repoBase}/pullrequests/${prId}`,
    token,
    payload,
  )
}

// ---------------------------------------------------------------------------
// PR metadata mutations
// ---------------------------------------------------------------------------

/**
 * Update PR title.
 * PATCH /{org}/{project}/_apis/git/repositories/{repo}/pullrequests/{id}
 */
export function updatePRTitle(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  prId: number,
  title: string,
): Effect.Effect<void, AzureError | NetworkError> {
  const repoBase = gitApiBase(baseUrl, owner, repo)
  return mutateAzure(
    'PATCH',
    baseUrl,
    `${repoBase}/pullrequests/${prId}`,
    token,
    { title },
  )
}

/**
 * Update PR description.
 * PATCH /{org}/{project}/_apis/git/repositories/{repo}/pullrequests/{id}
 */
export function updatePRDescription(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  prId: number,
  description: string,
): Effect.Effect<void, AzureError | NetworkError> {
  const repoBase = gitApiBase(baseUrl, owner, repo)
  return mutateAzure(
    'PATCH',
    baseUrl,
    `${repoBase}/pullrequests/${prId}`,
    token,
    { description },
  )
}

// ---------------------------------------------------------------------------
// Draft operations
// ---------------------------------------------------------------------------

/**
 * Set PR draft status.
 * PATCH /{org}/{project}/_apis/git/repositories/{repo}/pullrequests/{id}
 */
export function setDraftStatus(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  prId: number,
  isDraft: boolean,
): Effect.Effect<void, AzureError | NetworkError> {
  const repoBase = gitApiBase(baseUrl, owner, repo)
  return mutateAzure(
    'PATCH',
    baseUrl,
    `${repoBase}/pullrequests/${prId}`,
    token,
    { isDraft },
  )
}

// ---------------------------------------------------------------------------
// Reviewer management
// ---------------------------------------------------------------------------

/**
 * Add a reviewer to a PR.
 * PUT /{org}/{project}/_apis/git/repositories/{repo}/pullrequests/{id}/reviewers/{reviewerId}
 */
export function addReviewer(
  baseUrl: string,
  token: string,
  owner: string,
  repo: string,
  prId: number,
  reviewerId: string,
): Effect.Effect<void, AzureError | NetworkError> {
  const repoBase = gitApiBase(baseUrl, owner, repo)
  return mutateAzure(
    'PUT',
    baseUrl,
    `${repoBase}/pullrequests/${prId}/reviewers/${reviewerId}`,
    token,
    { vote: 0 },
  )
}

// ---------------------------------------------------------------------------
// Current user
// ---------------------------------------------------------------------------

/**
 * Get the currently authenticated user.
 * Uses the Azure DevOps User Profile API:
 * GET https://app.vssps.visualstudio.com/_apis/profile/profiles/me
 */
export function getCurrentUser(
  token: string,
): Effect.Effect<
  { readonly displayName: string; readonly id: string; readonly emailAddress: string },
  AzureError | NetworkError
> {
  return fetchAzure<{
    readonly displayName: string
    readonly id: string
    readonly emailAddress: string
  }>(
    'https://app.vssps.visualstudio.com',
    '/_apis/profile/profiles/me',
    token,
  )
}

/**
 * Get the current user's identity from the connection data endpoint.
 * GET https://dev.azure.com/{org}/_apis/connectionData
 */
export function getConnectionData(
  baseUrl: string,
  token: string,
  owner: string,
): Effect.Effect<
  { readonly authenticatedUser: { readonly id: string; readonly providerDisplayName: string } },
  AzureError | NetworkError
> {
  const { org } = parseAzureOwner(owner)
  return fetchAzure<{
    readonly authenticatedUser: {
      readonly id: string
      readonly providerDisplayName: string
    }
  }>(baseUrl, `/${org}/_apis/connectionData`, token)
}
