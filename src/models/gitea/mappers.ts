import { PullRequest, Label, BranchRef } from '../pull-request'
import { User } from '../user'
import { Comment } from '../comment'
import { IssueComment } from '../issue-comment'
import { Review } from '../review'
import { FileChange } from '../file-change'
import { Commit, CommitDetails, CommitAuthor } from '../commit'
import type { GiteaUser, GiteaPullRequest } from './pull-request'
import type { GiteaReviewComment, GiteaIssueComment } from './comment'
import type { GiteaReview } from './review'
import type { GiteaChangedFile } from './diff'
import type { GiteaCommit } from './commit'

// ---------------------------------------------------------------------------
// User mapper
// ---------------------------------------------------------------------------

export function mapGiteaUser(giteaUser: GiteaUser): User {
  return new User({
    login: giteaUser.login,
    id: giteaUser.id,
    avatar_url: giteaUser.avatar_url ?? '',
    html_url: '',
    type: 'User',
  })
}

// ---------------------------------------------------------------------------
// Pull Request mapper
// ---------------------------------------------------------------------------

export function mapGiteaPRToPullRequest(
  giteaPR: GiteaPullRequest,
): PullRequest {
  const merged = giteaPR.merged ?? false
  const state: 'open' | 'closed' = giteaPR.state === 'open' ? 'open' : 'closed'

  return new PullRequest({
    id: giteaPR.number,
    node_id: '',
    number: giteaPR.number,
    title: giteaPR.title,
    body: giteaPR.body || null,
    state,
    draft: false,
    merged,
    user: mapGiteaUser(giteaPR.user),
    labels: giteaPR.labels.map(
      (l) =>
        new Label({
          id: 0,
          name: l.name,
          color: l.color,
          description: null,
        }),
    ),
    created_at: giteaPR.created_at,
    updated_at: giteaPR.updated_at,
    merged_at: merged ? giteaPR.updated_at : null,
    closed_at: state === 'closed' && !merged ? giteaPR.updated_at : null,
    html_url: giteaPR.html_url ?? '',
    head: new BranchRef({
      ref: giteaPR.head.ref,
      sha: giteaPR.head.sha,
    }),
    base: new BranchRef({
      ref: giteaPR.base.ref,
      sha: giteaPR.base.sha,
    }),
    additions: 0,
    deletions: 0,
    changed_files: 0,
    comments: giteaPR.comments ?? 0,
    review_comments: 0,
    requested_reviewers: (giteaPR.requested_reviewers ?? []).map(mapGiteaUser),
    assignees: (giteaPR.assignees ?? []).map(mapGiteaUser),
    mergeable: giteaPR.mergeable ?? null,
    mergeable_state: null,
    merge_commit_sha: null,
  })
}

// ---------------------------------------------------------------------------
// Review comment -> Comment (inline diff comments)
// ---------------------------------------------------------------------------

export function mapGiteaReviewCommentToComment(
  rc: GiteaReviewComment,
): Comment {
  // Determine side: if old_line_num is set but new_line_num is 0, it's LEFT
  const isOldSide =
    (rc.old_line_num != null && rc.old_line_num > 0) &&
    (rc.new_line_num == null || rc.new_line_num === 0)
  const side = isOldSide ? ('LEFT' as const) : ('RIGHT' as const)
  const line = isOldSide
    ? (rc.old_line_num ?? undefined)
    : (rc.new_line_num ?? rc.line ?? undefined)

  return new Comment({
    id: rc.id,
    node_id: String(rc.id),
    body: rc.body,
    user: mapGiteaUser(rc.user),
    created_at: rc.created_at,
    updated_at: rc.updated_at,
    html_url: rc.html_url ?? '',
    path: rc.path || undefined,
    line,
    side,
    in_reply_to_id: undefined,
  })
}

export function mapGiteaReviewCommentsToComments(
  comments: readonly GiteaReviewComment[],
): readonly Comment[] {
  return comments.map(mapGiteaReviewCommentToComment)
}

// ---------------------------------------------------------------------------
// Issue comment -> IssueComment (general comments)
// ---------------------------------------------------------------------------

export function mapGiteaIssueCommentToIssueComment(
  ic: GiteaIssueComment,
): IssueComment {
  return new IssueComment({
    id: ic.id,
    node_id: String(ic.id),
    body: ic.body,
    user: mapGiteaUser(ic.user),
    created_at: ic.created_at,
    updated_at: ic.updated_at,
    html_url: ic.html_url ?? '',
  })
}

export function mapGiteaIssueCommentsToIssueComments(
  comments: readonly GiteaIssueComment[],
): readonly IssueComment[] {
  return comments.map(mapGiteaIssueCommentToIssueComment)
}

// ---------------------------------------------------------------------------
// Review mapper
// ---------------------------------------------------------------------------

/**
 * Map Gitea review state strings to our normalized review states.
 *
 * Gitea uses: PENDING, APPROVED, REQUEST_CHANGES, COMMENT, REQUEST_REVIEW
 * Our model uses: APPROVED, CHANGES_REQUESTED, COMMENTED, DISMISSED, PENDING
 */
function mapGiteaReviewState(
  state: string,
): 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING' {
  switch (state) {
    case 'APPROVED':
      return 'APPROVED'
    case 'REQUEST_CHANGES':
      return 'CHANGES_REQUESTED'
    case 'PENDING':
      return 'PENDING'
    case 'COMMENT':
    case 'REQUEST_REVIEW':
    default:
      return 'COMMENTED'
  }
}

export function mapGiteaReviewToReview(giteaReview: GiteaReview): Review {
  return new Review({
    id: giteaReview.id,
    user: mapGiteaUser(giteaReview.user),
    body: giteaReview.body || null,
    state: mapGiteaReviewState(giteaReview.state),
    submitted_at: giteaReview.submitted_at ?? null,
    html_url: giteaReview.html_url ?? '',
  })
}

export function mapGiteaReviewsToReviews(
  reviews: readonly GiteaReview[],
): readonly Review[] {
  return reviews.map(mapGiteaReviewToReview)
}

// ---------------------------------------------------------------------------
// Changed file -> FileChange
// ---------------------------------------------------------------------------

function mapGiteaFileStatus(
  status: string,
): FileChange['status'] {
  switch (status) {
    case 'added':
      return 'added'
    case 'removed':
      return 'removed'
    case 'renamed':
      return 'renamed'
    case 'copied':
      return 'copied'
    case 'changed':
      return 'changed'
    case 'modified':
    default:
      return 'modified'
  }
}

export function mapGiteaChangedFileToFileChange(
  file: GiteaChangedFile,
): FileChange {
  return new FileChange({
    sha: '',
    filename: file.filename,
    status: mapGiteaFileStatus(file.status),
    additions: file.additions ?? 0,
    deletions: file.deletions ?? 0,
    changes: file.changes ?? 0,
    previous_filename: file.previous_filename,
  })
}

export function mapGiteaChangedFilesToFileChanges(
  files: readonly GiteaChangedFile[],
): readonly FileChange[] {
  return files.map(mapGiteaChangedFileToFileChange)
}

// ---------------------------------------------------------------------------
// Commit mapper
// ---------------------------------------------------------------------------

export function mapGiteaCommitToCommit(giteaCommit: GiteaCommit): Commit {
  return new Commit({
    sha: giteaCommit.sha,
    commit: new CommitDetails({
      message: giteaCommit.commit.message,
      author: new CommitAuthor({
        name: giteaCommit.commit.author.name,
        email: giteaCommit.commit.author.email,
        date: giteaCommit.commit.author.date,
      }),
    }),
    author: giteaCommit.author ? mapGiteaUser(giteaCommit.author) : null,
    html_url: giteaCommit.html_url ?? '',
  })
}

export function mapGiteaCommitsToCommits(
  commits: readonly GiteaCommit[],
): readonly Commit[] {
  return commits.map(mapGiteaCommitToCommit)
}
