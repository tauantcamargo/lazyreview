import { PullRequest, Label, BranchRef } from '../pull-request'
import { User } from '../user'
import { Comment } from '../comment'
import { IssueComment } from '../issue-comment'
import { Review } from '../review'
import { FileChange } from '../file-change'
import { Commit, CommitDetails, CommitAuthor } from '../commit'
import { CheckRun, CheckRunsResponse } from '../check'
import type { AzureIdentity, AzureReviewer, AzurePullRequest } from './pull-request'
import type { AzureThread, AzureComment as AzureCommentType } from './comment'
import type { AzureIterationChange } from './diff'
import type { AzureBuild } from './build'
import type { AzureCommit } from './commit'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Hash a string to produce a stable numeric ID.
 * Azure uses GUIDs for identifiers; we need numeric IDs for normalized types.
 */
function hashString(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }
  return Math.abs(hash)
}

/**
 * Strip "refs/heads/" prefix from Azure branch ref names.
 */
function stripRefsPrefix(refName: string): string {
  return refName.replace(/^refs\/heads\//, '')
}

/**
 * Build a PR HTML URL from Azure DevOps components.
 */
function buildPRHtmlUrl(
  baseUrl: string,
  org: string,
  project: string,
  repoName: string,
  prId: number,
): string {
  return `${baseUrl}/${org}/${project}/_git/${repoName}/pullrequest/${prId}`
}

// ---------------------------------------------------------------------------
// User mapper
// ---------------------------------------------------------------------------

export function mapAzureIdentity(identity: AzureIdentity): User {
  return new User({
    login: identity.uniqueName ?? identity.displayName,
    id: hashString(identity.id),
    avatar_url: identity.imageUrl ?? '',
    html_url: '',
    type: 'User',
  })
}

// ---------------------------------------------------------------------------
// Reviewer vote mapper
// ---------------------------------------------------------------------------

/**
 * Map Azure DevOps reviewer vote to normalized review state.
 *
 * Azure votes:
 *  10  = Approved
 *   5  = Approved with suggestions
 *   0  = No response
 *  -5  = Waiting for author
 * -10  = Rejected
 */
function mapReviewerVoteToState(
  vote: number,
): Review['state'] {
  if (vote >= 10) return 'APPROVED'
  if (vote === 5) return 'APPROVED'
  if (vote <= -10) return 'CHANGES_REQUESTED'
  if (vote === -5) return 'CHANGES_REQUESTED'
  return 'COMMENTED'
}

export function mapAzureReviewerToReview(
  reviewer: AzureReviewer,
  prHtmlUrl: string,
  updatedAt: string,
): Review {
  return new Review({
    id: hashString(reviewer.id),
    user: new User({
      login: reviewer.uniqueName ?? reviewer.displayName,
      id: hashString(reviewer.id),
      avatar_url: reviewer.imageUrl ?? '',
      html_url: '',
      type: 'User',
    }),
    body: null,
    state: mapReviewerVoteToState(reviewer.vote),
    submitted_at: updatedAt,
    html_url: prHtmlUrl,
  })
}

export function mapAzureReviewersToReviews(
  reviewers: readonly AzureReviewer[],
  prHtmlUrl: string,
  updatedAt: string,
): readonly Review[] {
  return reviewers
    .filter((r) => r.vote !== 0)
    .map((r) => mapAzureReviewerToReview(r, prHtmlUrl, updatedAt))
}

// ---------------------------------------------------------------------------
// Pull Request mapper
// ---------------------------------------------------------------------------

export function mapAzurePRToPullRequest(
  azPR: AzurePullRequest,
  baseUrl: string,
  org: string,
  project: string,
  repoName: string,
): PullRequest {
  const state: 'open' | 'closed' = azPR.status === 'active' ? 'open' : 'closed'
  const merged = azPR.status === 'completed'
  const htmlUrl = buildPRHtmlUrl(baseUrl, org, project, repoName, azPR.pullRequestId)

  // Map Azure labels to normalized labels
  const labels = azPR.labels.map((label, index) =>
    new Label({
      id: hashString(label.id ?? String(index)),
      name: label.name,
      color: '',
      description: null,
    }),
  )

  return new PullRequest({
    id: azPR.pullRequestId,
    node_id: '',
    number: azPR.pullRequestId,
    title: azPR.title,
    body: azPR.description || null,
    state,
    draft: azPR.isDraft,
    merged,
    user: mapAzureIdentity(azPR.createdBy),
    labels,
    created_at: azPR.creationDate,
    updated_at: azPR.closedDate ?? azPR.creationDate,
    merged_at: merged ? (azPR.closedDate ?? azPR.creationDate) : null,
    closed_at:
      state === 'closed' && !merged
        ? (azPR.closedDate ?? azPR.creationDate)
        : null,
    html_url: htmlUrl,
    head: new BranchRef({
      ref: stripRefsPrefix(azPR.sourceRefName),
      sha: azPR.lastMergeSourceCommit?.commitId ?? '',
    }),
    base: new BranchRef({
      ref: stripRefsPrefix(azPR.targetRefName),
      sha: azPR.lastMergeTargetCommit?.commitId ?? '',
    }),
    additions: 0,
    deletions: 0,
    changed_files: 0,
    comments: 0,
    review_comments: 0,
    requested_reviewers: azPR.reviewers
      .filter((r) => r.vote === 0)
      .map((r) =>
        new User({
          login: r.uniqueName ?? r.displayName,
          id: hashString(r.id),
          avatar_url: r.imageUrl ?? '',
          html_url: '',
          type: 'User',
        }),
      ),
    assignees: [],
    mergeable: null,
    mergeable_state: azPR.mergeStatus ?? null,
    merge_commit_sha: azPR.lastMergeCommit?.commitId ?? null,
  })
}

// ---------------------------------------------------------------------------
// Thread / Comment mappers
// ---------------------------------------------------------------------------

/**
 * Determine if a thread is a diff-attached (inline) comment thread.
 */
function isInlineThread(thread: AzureThread): boolean {
  return thread.threadContext != null
}

/**
 * Determine if a thread contains only system-generated comments.
 */
function isSystemThread(thread: AzureThread): boolean {
  return thread.comments.every(
    (c) => c.commentType === 'system' || c.commentType === 'codeChange',
  )
}

export function mapAzureCommentToComment(
  comment: AzureCommentType,
  thread: AzureThread,
  prHtmlUrl: string,
): Comment {
  const threadContext = thread.threadContext
  const path = threadContext?.filePath
  const line = threadContext?.rightFileStart?.line ?? threadContext?.leftFileStart?.line ?? undefined
  const side: 'LEFT' | 'RIGHT' | undefined = threadContext
    ? threadContext.rightFileStart != null
      ? 'RIGHT'
      : 'LEFT'
    : undefined

  return new Comment({
    id: comment.id,
    node_id: `${thread.id}:${comment.id}`,
    body: comment.content,
    user: mapAzureIdentity(comment.author),
    created_at: comment.publishedDate ?? '',
    updated_at: comment.lastUpdatedDate ?? comment.publishedDate ?? '',
    html_url: `${prHtmlUrl}?_a=files&discussionId=${thread.id}`,
    path,
    line,
    side,
    in_reply_to_id: comment.parentCommentId > 0 ? comment.parentCommentId : undefined,
  })
}

/**
 * Map Azure threads to normalized inline (diff) comments.
 * Only includes threads with a threadContext (file position).
 */
export function mapAzureThreadsToComments(
  threads: readonly AzureThread[],
  prHtmlUrl: string,
): readonly Comment[] {
  const result: Comment[] = []

  for (const thread of threads) {
    if (thread.isDeleted) continue
    if (isSystemThread(thread)) continue
    if (!isInlineThread(thread)) continue

    for (const comment of thread.comments) {
      if (comment.commentType === 'system') continue
      result.push(mapAzureCommentToComment(comment, thread, prHtmlUrl))
    }
  }

  return result
}

/**
 * Map Azure threads to normalized issue comments (general, non-inline).
 */
export function mapAzureThreadsToIssueComments(
  threads: readonly AzureThread[],
  prHtmlUrl: string,
): readonly IssueComment[] {
  const result: IssueComment[] = []

  for (const thread of threads) {
    if (thread.isDeleted) continue
    if (isSystemThread(thread)) continue
    if (isInlineThread(thread)) continue

    for (const comment of thread.comments) {
      if (comment.commentType === 'system') continue
      result.push(
        new IssueComment({
          id: comment.id,
          node_id: `${thread.id}:${comment.id}`,
          body: comment.content,
          user: mapAzureIdentity(comment.author),
          created_at: comment.publishedDate ?? '',
          updated_at: comment.lastUpdatedDate ?? comment.publishedDate ?? '',
          html_url: `${prHtmlUrl}?_a=overview&discussionId=${thread.id}`,
        }),
      )
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Iteration Change -> FileChange
// ---------------------------------------------------------------------------

function mapChangeType(
  changeType: string,
): FileChange['status'] {
  const lower = changeType.toLowerCase()
  if (lower === 'add' || lower === '1') return 'added'
  if (lower === 'delete' || lower === '16') return 'removed'
  if (lower === 'rename' || lower === '8') return 'renamed'
  if (lower === 'edit' || lower === '2') return 'modified'
  if (lower === 'edit, rename' || lower === '10') return 'renamed'
  return 'modified'
}

export function mapAzureChangeToFileChange(
  change: AzureIterationChange,
): FileChange {
  const status = mapChangeType(change.changeType)
  const filename = change.item?.path ?? ''

  return new FileChange({
    sha: '',
    filename: filename.startsWith('/') ? filename.slice(1) : filename,
    status,
    additions: 0,
    deletions: 0,
    changes: 0,
    previous_filename:
      status === 'renamed' && change.originalPath
        ? (change.originalPath.startsWith('/')
            ? change.originalPath.slice(1)
            : change.originalPath)
        : undefined,
  })
}

// ---------------------------------------------------------------------------
// Commit mapper
// ---------------------------------------------------------------------------

export function mapAzureCommitToCommit(
  azCommit: AzureCommit,
  remoteUrl?: string,
): Commit {
  return new Commit({
    sha: azCommit.commitId,
    commit: new CommitDetails({
      message: azCommit.comment,
      author: new CommitAuthor({
        name: azCommit.author.name,
        email: azCommit.author.email,
        date: azCommit.author.date,
      }),
    }),
    author: null,
    html_url: azCommit.remoteUrl ?? remoteUrl ?? '',
  })
}

// ---------------------------------------------------------------------------
// Build -> CheckRun
// ---------------------------------------------------------------------------

function mapBuildStatus(
  status: AzureBuild['status'],
): CheckRun['status'] {
  switch (status) {
    case 'completed':
      return 'completed'
    case 'inProgress':
      return 'in_progress'
    case 'notStarted':
    case 'postponed':
    case 'none':
    case 'all':
    case 'cancelling':
      return 'queued'
  }
}

function mapBuildResult(
  build: AzureBuild,
): CheckRun['conclusion'] {
  if (build.status !== 'completed' || !build.result) {
    return null
  }

  switch (build.result) {
    case 'succeeded':
      return 'success'
    case 'partiallySucceeded':
      return 'neutral'
    case 'failed':
      return 'failure'
    case 'canceled':
      return 'cancelled'
    case 'none':
      return null
  }
}

export function mapAzureBuildToCheckRun(build: AzureBuild): CheckRun {
  return new CheckRun({
    id: build.id,
    name: build.definition?.name ?? build.buildNumber ?? String(build.id),
    status: mapBuildStatus(build.status),
    conclusion: mapBuildResult(build),
    html_url: build._links?.web?.href ?? null,
    details_url: build.url ?? null,
  })
}

export function mapAzureBuildsToCheckRunsResponse(
  builds: readonly AzureBuild[],
): CheckRunsResponse {
  const checkRuns = builds.map(mapAzureBuildToCheckRun)
  return new CheckRunsResponse({
    total_count: checkRuns.length,
    check_runs: checkRuns,
  })
}
