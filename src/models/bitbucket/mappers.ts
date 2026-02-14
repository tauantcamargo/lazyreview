import { PullRequest, Label, BranchRef } from '../pull-request'
import { User } from '../user'
import { Comment } from '../comment'
import { IssueComment } from '../issue-comment'
import { Review } from '../review'
import { FileChange } from '../file-change'
import { Commit, CommitDetails, CommitAuthor } from '../commit'
import { CheckRun, CheckRunsResponse } from '../check'
import type { BitbucketUser, BitbucketParticipant, BitbucketPullRequest } from './pull-request'
import type { BitbucketComment } from './comment'
import type { BitbucketDiffStat } from './diff'
import type { BitbucketCommit } from './commit'
import type { BitbucketPipelineStep } from './pipeline'

// ---------------------------------------------------------------------------
// User mapper
// ---------------------------------------------------------------------------

export function mapBitbucketUser(bbUser: BitbucketUser): User {
  return new User({
    login: bbUser.nickname ?? bbUser.display_name,
    id: hashUuid(bbUser.uuid),
    avatar_url: bbUser.links?.avatar?.href ?? '',
    html_url: `https://bitbucket.org/${bbUser.nickname ?? bbUser.uuid}`,
    type: 'User',
  })
}

/**
 * Bitbucket uses UUIDs for user identification rather than numeric IDs.
 * We hash the UUID to produce a stable numeric ID for the normalized User type.
 */
function hashUuid(uuid: string): number {
  let hash = 0
  for (let i = 0; i < uuid.length; i++) {
    const char = uuid.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }
  return Math.abs(hash)
}

// ---------------------------------------------------------------------------
// Pull Request mapper
// ---------------------------------------------------------------------------

export function mapBitbucketPRToPullRequest(
  bbPR: BitbucketPullRequest,
): PullRequest {
  const state: 'open' | 'closed' = bbPR.state === 'OPEN' ? 'open' : 'closed'
  const merged = bbPR.state === 'MERGED'

  return new PullRequest({
    id: bbPR.id,
    node_id: '',
    number: bbPR.id,
    title: bbPR.title,
    body: bbPR.description || null,
    state,
    draft: false,
    merged,
    user: mapBitbucketUser(bbPR.author),
    labels: [],
    created_at: bbPR.created_on,
    updated_at: bbPR.updated_on,
    merged_at: merged ? bbPR.updated_on : null,
    closed_at: state === 'closed' && !merged ? bbPR.updated_on : null,
    html_url: bbPR.links.html.href,
    head: new BranchRef({
      ref: bbPR.source.branch.name,
      sha: bbPR.source.commit.hash,
    }),
    base: new BranchRef({
      ref: bbPR.destination.branch.name,
      sha: bbPR.destination.commit.hash,
    }),
    additions: 0,
    deletions: 0,
    changed_files: 0,
    comments: bbPR.comment_count,
    review_comments: 0,
    requested_reviewers: bbPR.reviewers.map(mapBitbucketUser),
    assignees: [],
    mergeable: null,
    mergeable_state: null,
    merge_commit_sha: bbPR.merge_commit?.hash ?? null,
  })
}

// ---------------------------------------------------------------------------
// Comment mapper (inline / diff comments)
// ---------------------------------------------------------------------------

export function mapBitbucketCommentToComment(
  bbComment: BitbucketComment,
  prHtmlUrl: string,
): Comment {
  return new Comment({
    id: bbComment.id,
    node_id: String(bbComment.id),
    body: bbComment.content.raw,
    user: mapBitbucketUser(bbComment.user),
    created_at: bbComment.created_on,
    updated_at: bbComment.updated_on,
    html_url: `${prHtmlUrl}#comment-${bbComment.id}`,
    path: bbComment.inline?.path,
    line: bbComment.inline?.to ?? bbComment.inline?.from ?? undefined,
    side: bbComment.inline
      ? bbComment.inline.to !== null && bbComment.inline.to !== undefined
        ? ('RIGHT' as const)
        : ('LEFT' as const)
      : undefined,
    in_reply_to_id: bbComment.parent?.id,
  })
}

/**
 * Maps Bitbucket comments to normalized Comment objects.
 * Filters out deleted comments.
 */
export function mapBitbucketCommentsToComments(
  comments: readonly BitbucketComment[],
  prHtmlUrl: string,
): readonly Comment[] {
  return comments
    .filter((c) => !c.deleted)
    .map((c) => mapBitbucketCommentToComment(c, prHtmlUrl))
}

// ---------------------------------------------------------------------------
// Comment -> IssueComment (general comments without inline position)
// ---------------------------------------------------------------------------

export function mapBitbucketCommentToIssueComment(
  bbComment: BitbucketComment,
  prHtmlUrl: string,
): IssueComment {
  return new IssueComment({
    id: bbComment.id,
    node_id: String(bbComment.id),
    body: bbComment.content.raw,
    user: mapBitbucketUser(bbComment.user),
    created_at: bbComment.created_on,
    updated_at: bbComment.updated_on,
    html_url: `${prHtmlUrl}#comment-${bbComment.id}`,
  })
}

/**
 * Maps Bitbucket comments that are not inline to IssueComment objects.
 * Filters out deleted comments and inline (diff) comments.
 */
export function mapBitbucketCommentsToIssueComments(
  comments: readonly BitbucketComment[],
  prHtmlUrl: string,
): readonly IssueComment[] {
  return comments
    .filter((c) => !c.deleted && !c.inline)
    .map((c) => mapBitbucketCommentToIssueComment(c, prHtmlUrl))
}

// ---------------------------------------------------------------------------
// DiffStat -> FileChange
// ---------------------------------------------------------------------------

function mapDiffStatStatus(
  status: BitbucketDiffStat['status'],
): FileChange['status'] {
  switch (status) {
    case 'added':
      return 'added'
    case 'removed':
      return 'removed'
    case 'renamed':
      return 'renamed'
    case 'modified':
    case 'merge conflict':
      return 'modified'
  }
}

export function mapBitbucketDiffStatToFileChange(
  diffStat: BitbucketDiffStat,
): FileChange {
  const status = mapDiffStatStatus(diffStat.status)
  const filename = diffStat.new?.path ?? diffStat.old?.path ?? ''

  return new FileChange({
    sha: '',
    filename,
    status,
    additions: diffStat.lines_added,
    deletions: diffStat.lines_removed,
    changes: diffStat.lines_added + diffStat.lines_removed,
    previous_filename:
      status === 'renamed' && diffStat.old
        ? diffStat.old.path
        : undefined,
  })
}

// ---------------------------------------------------------------------------
// Commit mapper
// ---------------------------------------------------------------------------

/**
 * Parses "Author Name <email>" format from Bitbucket's raw author string.
 */
function parseRawAuthor(raw: string): {
  readonly name: string
  readonly email: string
} {
  const match = raw.match(/^(.+?)\s*<(.+?)>$/)
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() }
  }
  return { name: raw, email: '' }
}

export function mapBitbucketCommitToCommit(
  bbCommit: BitbucketCommit,
): Commit {
  const { name, email } = parseRawAuthor(bbCommit.author.raw)
  const htmlUrl = bbCommit.links?.html?.href ?? ''

  return new Commit({
    sha: bbCommit.hash,
    commit: new CommitDetails({
      message: bbCommit.message,
      author: new CommitAuthor({
        name,
        email,
        date: bbCommit.date,
      }),
    }),
    author: bbCommit.author.user
      ? mapBitbucketUser(bbCommit.author.user)
      : null,
    html_url: htmlUrl,
  })
}

// ---------------------------------------------------------------------------
// Pipeline Step -> CheckRun
// ---------------------------------------------------------------------------

function mapStepStatus(
  stateName: BitbucketPipelineStep['state']['name'],
): CheckRun['status'] {
  switch (stateName) {
    case 'COMPLETED':
      return 'completed'
    case 'IN_PROGRESS':
      return 'in_progress'
    case 'PENDING':
    case 'PAUSED':
    case 'HALTED':
      return 'queued'
  }
}

function mapStepConclusion(
  step: BitbucketPipelineStep,
): CheckRun['conclusion'] {
  if (step.state.name !== 'COMPLETED' || !step.state.result) {
    return null
  }

  switch (step.state.result.name) {
    case 'SUCCESSFUL':
      return 'success'
    case 'FAILED':
    case 'ERROR':
      return 'failure'
    case 'STOPPED':
      return 'cancelled'
    case 'EXPIRED':
      return 'timed_out'
    case 'NOT_RUN':
      return 'skipped'
  }
}

export function mapBitbucketPipelineStepToCheckRun(
  step: BitbucketPipelineStep,
): CheckRun {
  return new CheckRun({
    id: hashUuid(step.uuid),
    name: step.name ?? step.uuid,
    status: mapStepStatus(step.state.name),
    conclusion: mapStepConclusion(step),
    html_url: null,
    details_url: null,
  })
}

/**
 * Maps an array of pipeline steps to a CheckRunsResponse,
 * matching the shape expected by the Provider interface.
 */
export function mapBitbucketPipelineStepsToCheckRunsResponse(
  steps: readonly BitbucketPipelineStep[],
): CheckRunsResponse {
  const checkRuns = steps.map(mapBitbucketPipelineStepToCheckRun)
  return new CheckRunsResponse({
    total_count: checkRuns.length,
    check_runs: checkRuns,
  })
}

// ---------------------------------------------------------------------------
// Participant -> Review
// ---------------------------------------------------------------------------

/**
 * Bitbucket does not have a first-class "review" concept like GitHub.
 * Instead, participants have roles and approval states.
 * We map REVIEWER participants to normalized Review objects.
 */
export function mapParticipantToReview(
  participant: BitbucketParticipant,
  prHtmlUrl: string,
  updatedOn: string,
): Review {
  let reviewState: Review['state']
  if (participant.state === 'changes_requested') {
    reviewState = 'CHANGES_REQUESTED'
  } else if (participant.approved) {
    reviewState = 'APPROVED'
  } else {
    reviewState = 'COMMENTED'
  }

  return new Review({
    id: hashUuid(participant.user.uuid),
    user: mapBitbucketUser(participant.user),
    body: null,
    state: reviewState,
    submitted_at: updatedOn,
    html_url: prHtmlUrl,
  })
}

/**
 * Extracts reviews from participants that have the REVIEWER role.
 */
export function mapParticipantsToReviews(
  participants: readonly BitbucketParticipant[],
  prHtmlUrl: string,
  updatedOn: string,
): readonly Review[] {
  return participants
    .filter((p) => p.role === 'REVIEWER')
    .map((p) => mapParticipantToReview(p, prHtmlUrl, updatedOn))
}
