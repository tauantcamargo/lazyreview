import { PullRequest, Label, BranchRef } from '../pull-request'
import { User } from '../user'
import { Comment } from '../comment'
import { IssueComment } from '../issue-comment'
import { Review } from '../review'
import { FileChange } from '../file-change'
import { Commit, CommitDetails, CommitAuthor } from '../commit'
import { CheckRun, CheckRunsResponse } from '../check'
import type { GitLabMergeRequest, GitLabUser } from './merge-request'
import type { GitLabNote } from './note'
import type { GitLabDiff } from './diff'
import type { GitLabCommit } from './commit'
import type { GitLabPipelineJob } from './pipeline'

// ---------------------------------------------------------------------------
// User mapper
// ---------------------------------------------------------------------------

export function mapGitLabUser(glUser: GitLabUser): User {
  return new User({
    login: glUser.username,
    id: glUser.id,
    avatar_url: glUser.avatar_url ?? '',
    html_url: glUser.web_url,
    type: 'User',
  })
}

// ---------------------------------------------------------------------------
// Merge Request -> PullRequest
// ---------------------------------------------------------------------------

export function mapMergeRequestToPR(mr: GitLabMergeRequest): PullRequest {
  const state: 'open' | 'closed' = mr.state === 'opened' ? 'open' : 'closed'
  const merged = mr.state === 'merged'

  return new PullRequest({
    id: mr.id,
    node_id: '',
    number: mr.iid,
    title: mr.title,
    body: mr.description ?? null,
    state,
    draft: mr.draft,
    merged,
    user: mapGitLabUser(mr.author),
    labels: mr.labels.map(
      (name) =>
        new Label({
          id: 0,
          name,
          color: '',
          description: null,
        }),
    ),
    created_at: mr.created_at,
    updated_at: mr.updated_at,
    merged_at: mr.merged_at ?? null,
    closed_at: mr.closed_at ?? null,
    html_url: mr.web_url,
    head: new BranchRef({
      ref: mr.source_branch,
      sha: mr.sha,
    }),
    base: new BranchRef({
      ref: mr.target_branch,
      sha: mr.diff_refs?.base_sha ?? '',
    }),
    additions: 0,
    deletions: 0,
    changed_files: 0,
    comments: mr.user_notes_count,
    review_comments: 0,
    requested_reviewers: mr.reviewers.map(mapGitLabUser),
    assignees: mr.assignees.map(mapGitLabUser),
    mergeable: mr.has_conflicts ? false : null,
    mergeable_state: mr.merge_status ?? null,
    merge_commit_sha: mr.merge_commit_sha ?? null,
  })
}

// ---------------------------------------------------------------------------
// Note -> Comment (diff note with position)
// ---------------------------------------------------------------------------

export function mapNoteToComment(note: GitLabNote, mrWebUrl: string): Comment {
  return new Comment({
    id: note.id,
    node_id: String(note.id),
    body: note.body,
    user: mapGitLabUser(note.author),
    created_at: note.created_at,
    updated_at: note.updated_at,
    html_url: `${mrWebUrl}#note_${note.id}`,
    path: note.position?.new_path,
    line: note.position?.new_line ?? note.position?.old_line ?? undefined,
    side: note.position
      ? note.position.new_line !== null
        ? ('RIGHT' as const)
        : ('LEFT' as const)
      : undefined,
    in_reply_to_id: undefined,
  })
}

/**
 * Maps an array of GitLab notes to normalized Comment objects.
 * Filters out system-generated notes (merge events, label changes, etc.).
 */
export function mapNotesToComments(
  notes: readonly GitLabNote[],
  mrWebUrl: string,
): readonly Comment[] {
  return notes
    .filter((note) => !note.system)
    .map((note) => mapNoteToComment(note, mrWebUrl))
}

// ---------------------------------------------------------------------------
// Note -> IssueComment (general notes without diff position)
// ---------------------------------------------------------------------------

export function mapNoteToIssueComment(
  note: GitLabNote,
  mrWebUrl: string,
): IssueComment {
  return new IssueComment({
    id: note.id,
    node_id: String(note.id),
    body: note.body,
    user: mapGitLabUser(note.author),
    created_at: note.created_at,
    updated_at: note.updated_at,
    html_url: `${mrWebUrl}#note_${note.id}`,
  })
}

/**
 * Maps GitLab notes that are not diff-attached to IssueComment objects.
 * Filters out system notes and diff notes (those with a position).
 */
export function mapNotesToIssueComments(
  notes: readonly GitLabNote[],
  mrWebUrl: string,
): readonly IssueComment[] {
  return notes
    .filter((note) => !note.system && !note.position)
    .map((note) => mapNoteToIssueComment(note, mrWebUrl))
}

// ---------------------------------------------------------------------------
// Diff -> FileChange
// ---------------------------------------------------------------------------

function computeDiffStatus(
  diff: GitLabDiff,
): 'added' | 'removed' | 'modified' | 'renamed' {
  if (diff.new_file) return 'added'
  if (diff.deleted_file) return 'removed'
  if (diff.renamed_file) return 'renamed'
  return 'modified'
}

function countDiffLines(patch: string): {
  readonly additions: number
  readonly deletions: number
} {
  let additions = 0
  let deletions = 0

  for (const line of patch.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      additions += 1
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      deletions += 1
    }
  }

  return { additions, deletions }
}

export function mapDiffToFileChange(diff: GitLabDiff): FileChange {
  const status = computeDiffStatus(diff)
  const { additions, deletions } = countDiffLines(diff.diff)

  return new FileChange({
    sha: '',
    filename: diff.new_path,
    status,
    additions,
    deletions,
    changes: additions + deletions,
    patch: diff.diff,
    previous_filename: diff.renamed_file ? diff.old_path : undefined,
  })
}

// ---------------------------------------------------------------------------
// GitLabCommit -> Commit
// ---------------------------------------------------------------------------

export function mapCommit(
  glCommit: GitLabCommit,
  repoWebUrl?: string,
): Commit {
  const htmlUrl =
    glCommit.web_url ?? (repoWebUrl ? `${repoWebUrl}/-/commit/${glCommit.id}` : '')

  return new Commit({
    sha: glCommit.id,
    commit: new CommitDetails({
      message: glCommit.message,
      author: new CommitAuthor({
        name: glCommit.author_name,
        email: glCommit.author_email,
        date: glCommit.authored_date,
      }),
    }),
    author: null,
    html_url: htmlUrl,
  })
}

// ---------------------------------------------------------------------------
// Pipeline Job -> CheckRun
// ---------------------------------------------------------------------------

function mapJobStatus(
  status: GitLabPipelineJob['status'],
): CheckRun['status'] {
  switch (status) {
    case 'success':
    case 'failed':
    case 'canceled':
    case 'skipped':
      return 'completed'
    case 'running':
      return 'in_progress'
    case 'created':
    case 'pending':
    case 'manual':
      return 'queued'
  }
}

function mapJobConclusion(
  status: GitLabPipelineJob['status'],
  allowFailure: boolean,
): CheckRun['conclusion'] {
  switch (status) {
    case 'success':
      return 'success'
    case 'failed':
      return allowFailure ? 'neutral' : 'failure'
    case 'canceled':
      return 'cancelled'
    case 'skipped':
      return 'skipped'
    case 'manual':
      return 'action_required'
    default:
      return null
  }
}

export function mapPipelineJobToCheckRun(job: GitLabPipelineJob): CheckRun {
  return new CheckRun({
    id: job.id,
    name: `${job.stage} / ${job.name}`,
    status: mapJobStatus(job.status),
    conclusion: mapJobConclusion(job.status, job.allow_failure),
    html_url: job.web_url,
    details_url: null,
  })
}

/**
 * Maps an array of pipeline jobs to a CheckRunsResponse,
 * matching the shape expected by the Provider interface.
 */
export function mapPipelineJobsToCheckRunsResponse(
  jobs: readonly GitLabPipelineJob[],
): CheckRunsResponse {
  const checkRuns = jobs.map(mapPipelineJobToCheckRun)
  return new CheckRunsResponse({
    total_count: checkRuns.length,
    check_runs: checkRuns,
  })
}

// ---------------------------------------------------------------------------
// Note -> Review (approximate mapping)
// ---------------------------------------------------------------------------

/**
 * GitLab does not have a first-class "review" concept like GitHub.
 * We synthesize reviews from approval events or from notes that act
 * as review-like activity. This mapper takes approval data and
 * converts it to the normalized Review type.
 */
export function mapApprovalToReview(
  glUser: GitLabUser,
  approvedAt: string,
  mrWebUrl: string,
): Review {
  return new Review({
    id: glUser.id,
    user: mapGitLabUser(glUser),
    body: null,
    state: 'APPROVED',
    submitted_at: approvedAt,
    html_url: mrWebUrl,
  })
}
