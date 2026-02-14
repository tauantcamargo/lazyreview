import { describe, it, expect } from 'vitest'
import {
  mapBitbucketUser,
  mapBitbucketPRToPullRequest,
  mapBitbucketCommentToComment,
  mapBitbucketCommentsToComments,
  mapBitbucketCommentToIssueComment,
  mapBitbucketCommentsToIssueComments,
  mapBitbucketDiffStatToFileChange,
  mapBitbucketCommitToCommit,
  mapBitbucketPipelineStepToCheckRun,
  mapBitbucketPipelineStepsToCheckRunsResponse,
  mapParticipantToReview,
  mapParticipantsToReviews,
} from './mappers'
import type { BitbucketUser, BitbucketParticipant, BitbucketPullRequest } from './pull-request'
import type { BitbucketComment } from './comment'
import type { BitbucketDiffStat } from './diff'
import type { BitbucketCommit } from './commit'
import type { BitbucketPipelineStep } from './pipeline'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const bbUser: BitbucketUser = {
  display_name: 'Jane Doe',
  uuid: '{abc-123-def}',
  nickname: 'janedoe',
  account_id: '12345',
  links: {
    avatar: { href: 'https://bitbucket.org/account/janedoe/avatar' },
  },
}

const bbUserMinimal: BitbucketUser = {
  display_name: 'John Smith',
  uuid: '{xyz-789-uvw}',
}

const prHtmlUrl = 'https://bitbucket.org/team/repo/pull-requests/42'

const minimalPR: BitbucketPullRequest = {
  id: 42,
  title: 'Add dark mode',
  description: 'Implements dark mode toggle',
  state: 'OPEN',
  author: bbUser,
  source: {
    branch: { name: 'feature/dark-mode' },
    commit: { hash: 'abc123' },
  },
  destination: {
    branch: { name: 'main' },
    commit: { hash: 'def456' },
  },
  reviewers: [],
  participants: [],
  created_on: '2026-01-15T10:00:00Z',
  updated_on: '2026-01-16T12:00:00Z',
  links: {
    html: { href: prHtmlUrl },
  },
  comment_count: 0,
  task_count: 0,
}

const generalComment: BitbucketComment = {
  id: 100,
  content: { raw: 'This looks great!' },
  user: bbUser,
  created_on: '2026-01-15T10:00:00Z',
  updated_on: '2026-01-15T10:00:00Z',
  deleted: false,
}

const inlineComment: BitbucketComment = {
  ...generalComment,
  id: 101,
  content: { raw: 'Nit: rename this variable' },
  inline: {
    path: 'src/utils.ts',
    from: null,
    to: 15,
  },
}

const inlineCommentOldSide: BitbucketComment = {
  ...generalComment,
  id: 102,
  content: { raw: 'This line was removed' },
  inline: {
    path: 'src/old.ts',
    from: 10,
    to: null,
  },
}

const replyComment: BitbucketComment = {
  ...generalComment,
  id: 103,
  content: { raw: 'Good point, will fix.' },
  parent: { id: 100 },
}

const deletedComment: BitbucketComment = {
  ...generalComment,
  id: 104,
  deleted: true,
}

const validDiffStat: BitbucketDiffStat = {
  status: 'modified',
  old: { path: 'src/utils.ts' },
  new: { path: 'src/utils.ts' },
  lines_added: 10,
  lines_removed: 3,
}

const bbCommit: BitbucketCommit = {
  hash: 'abc123def456',
  message: 'feat: add dark mode\n\nFull description here.',
  date: '2026-01-15T10:00:00Z',
  author: {
    raw: 'Jane Doe <jane@example.com>',
  },
}

const completedStep: BitbucketPipelineStep = {
  uuid: '{step-uuid-1}',
  name: 'Build & Test',
  state: {
    name: 'COMPLETED',
    result: { name: 'SUCCESSFUL' },
  },
  started_on: '2026-01-15T10:00:00Z',
  completed_on: '2026-01-15T10:05:00Z',
}

const reviewerParticipant: BitbucketParticipant = {
  user: bbUser,
  role: 'REVIEWER',
  approved: true,
  state: 'approved',
}

// ---------------------------------------------------------------------------
// mapBitbucketUser
// ---------------------------------------------------------------------------

describe('mapBitbucketUser', () => {
  it('maps nickname to login', () => {
    const user = mapBitbucketUser(bbUser)
    expect(user.login).toBe('janedoe')
  })

  it('falls back to display_name when no nickname', () => {
    const user = mapBitbucketUser(bbUserMinimal)
    expect(user.login).toBe('John Smith')
  })

  it('maps avatar href to avatar_url', () => {
    const user = mapBitbucketUser(bbUser)
    expect(user.avatar_url).toBe(
      'https://bitbucket.org/account/janedoe/avatar',
    )
  })

  it('defaults avatar_url to empty string when no links', () => {
    const user = mapBitbucketUser(bbUserMinimal)
    expect(user.avatar_url).toBe('')
  })

  it('generates a stable numeric id from uuid', () => {
    const user1 = mapBitbucketUser(bbUser)
    const user2 = mapBitbucketUser(bbUser)
    expect(typeof user1.id).toBe('number')
    expect(user1.id).toBe(user2.id)
    expect(user1.id).toBeGreaterThanOrEqual(0)
  })

  it('generates different ids for different uuids', () => {
    const user1 = mapBitbucketUser(bbUser)
    const user2 = mapBitbucketUser(bbUserMinimal)
    expect(user1.id).not.toBe(user2.id)
  })

  it('constructs html_url from nickname', () => {
    const user = mapBitbucketUser(bbUser)
    expect(user.html_url).toBe('https://bitbucket.org/janedoe')
  })

  it('constructs html_url from uuid when no nickname', () => {
    const user = mapBitbucketUser(bbUserMinimal)
    expect(user.html_url).toBe('https://bitbucket.org/{xyz-789-uvw}')
  })

  it('sets type to User', () => {
    const user = mapBitbucketUser(bbUser)
    expect(user.type).toBe('User')
  })
})

// ---------------------------------------------------------------------------
// mapBitbucketPRToPullRequest
// ---------------------------------------------------------------------------

describe('mapBitbucketPRToPullRequest', () => {
  it('maps id to number (Bitbucket PRs use id as number)', () => {
    const pr = mapBitbucketPRToPullRequest(minimalPR)
    expect(pr.number).toBe(42)
  })

  it('maps OPEN state to open', () => {
    const pr = mapBitbucketPRToPullRequest(minimalPR)
    expect(pr.state).toBe('open')
    expect(pr.merged).toBe(false)
  })

  it('maps MERGED state to closed with merged=true', () => {
    const pr = mapBitbucketPRToPullRequest({
      ...minimalPR,
      state: 'MERGED',
    })
    expect(pr.state).toBe('closed')
    expect(pr.merged).toBe(true)
  })

  it('maps DECLINED state to closed', () => {
    const pr = mapBitbucketPRToPullRequest({
      ...minimalPR,
      state: 'DECLINED',
    })
    expect(pr.state).toBe('closed')
    expect(pr.merged).toBe(false)
  })

  it('maps SUPERSEDED state to closed', () => {
    const pr = mapBitbucketPRToPullRequest({
      ...minimalPR,
      state: 'SUPERSEDED',
    })
    expect(pr.state).toBe('closed')
    expect(pr.merged).toBe(false)
  })

  it('maps source branch to head.ref', () => {
    const pr = mapBitbucketPRToPullRequest(minimalPR)
    expect(pr.head.ref).toBe('feature/dark-mode')
  })

  it('maps source commit hash to head.sha', () => {
    const pr = mapBitbucketPRToPullRequest(minimalPR)
    expect(pr.head.sha).toBe('abc123')
  })

  it('maps destination branch to base.ref', () => {
    const pr = mapBitbucketPRToPullRequest(minimalPR)
    expect(pr.base.ref).toBe('main')
  })

  it('maps destination commit hash to base.sha', () => {
    const pr = mapBitbucketPRToPullRequest(minimalPR)
    expect(pr.base.sha).toBe('def456')
  })

  it('maps links.html.href to html_url', () => {
    const pr = mapBitbucketPRToPullRequest(minimalPR)
    expect(pr.html_url).toBe(prHtmlUrl)
  })

  it('maps reviewers to requested_reviewers', () => {
    const pr = mapBitbucketPRToPullRequest({
      ...minimalPR,
      reviewers: [bbUser, bbUserMinimal],
    })
    expect(pr.requested_reviewers).toHaveLength(2)
    expect(pr.requested_reviewers[0].login).toBe('janedoe')
  })

  it('maps description to body', () => {
    const pr = mapBitbucketPRToPullRequest(minimalPR)
    expect(pr.body).toBe('Implements dark mode toggle')
  })

  it('maps empty description to null body', () => {
    const pr = mapBitbucketPRToPullRequest({
      ...minimalPR,
      description: '',
    })
    expect(pr.body).toBeNull()
  })

  it('maps comment_count to comments', () => {
    const pr = mapBitbucketPRToPullRequest({
      ...minimalPR,
      comment_count: 7,
    })
    expect(pr.comments).toBe(7)
  })

  it('maps merge_commit hash to merge_commit_sha', () => {
    const pr = mapBitbucketPRToPullRequest({
      ...minimalPR,
      merge_commit: { hash: 'merge123' },
    })
    expect(pr.merge_commit_sha).toBe('merge123')
  })

  it('maps null merge_commit to null merge_commit_sha', () => {
    const pr = mapBitbucketPRToPullRequest(minimalPR)
    expect(pr.merge_commit_sha).toBeNull()
  })

  it('maps timestamps', () => {
    const pr = mapBitbucketPRToPullRequest(minimalPR)
    expect(pr.created_at).toBe('2026-01-15T10:00:00Z')
    expect(pr.updated_at).toBe('2026-01-16T12:00:00Z')
  })

  it('sets merged_at to updated_on for merged PRs', () => {
    const pr = mapBitbucketPRToPullRequest({
      ...minimalPR,
      state: 'MERGED',
    })
    expect(pr.merged_at).toBe('2026-01-16T12:00:00Z')
  })

  it('sets closed_at to updated_on for declined PRs', () => {
    const pr = mapBitbucketPRToPullRequest({
      ...minimalPR,
      state: 'DECLINED',
    })
    expect(pr.closed_at).toBe('2026-01-16T12:00:00Z')
    expect(pr.merged_at).toBeNull()
  })

  it('sets both merged_at and closed_at to null for open PRs', () => {
    const pr = mapBitbucketPRToPullRequest(minimalPR)
    expect(pr.merged_at).toBeNull()
    expect(pr.closed_at).toBeNull()
  })

  it('sets draft to false (Bitbucket has no draft concept)', () => {
    const pr = mapBitbucketPRToPullRequest(minimalPR)
    expect(pr.draft).toBe(false)
  })

  it('sets assignees to empty array (Bitbucket has no assignees)', () => {
    const pr = mapBitbucketPRToPullRequest(minimalPR)
    expect(pr.assignees).toEqual([])
  })

  it('sets labels to empty array (Bitbucket has no labels)', () => {
    const pr = mapBitbucketPRToPullRequest(minimalPR)
    expect(pr.labels).toEqual([])
  })

  it('sets mergeable to null', () => {
    const pr = mapBitbucketPRToPullRequest(minimalPR)
    expect(pr.mergeable).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// mapBitbucketCommentToComment
// ---------------------------------------------------------------------------

describe('mapBitbucketCommentToComment', () => {
  it('maps an inline comment with path and line', () => {
    const comment = mapBitbucketCommentToComment(inlineComment, prHtmlUrl)
    expect(comment.id).toBe(101)
    expect(comment.body).toBe('Nit: rename this variable')
    expect(comment.user.login).toBe('janedoe')
    expect(comment.path).toBe('src/utils.ts')
    expect(comment.line).toBe(15)
    expect(comment.side).toBe('RIGHT')
  })

  it('maps a comment on the old side to LEFT', () => {
    const comment = mapBitbucketCommentToComment(
      inlineCommentOldSide,
      prHtmlUrl,
    )
    expect(comment.line).toBe(10)
    expect(comment.side).toBe('LEFT')
  })

  it('constructs html_url from PR URL and comment id', () => {
    const comment = mapBitbucketCommentToComment(
      inlineComment,
      prHtmlUrl,
    )
    expect(comment.html_url).toBe(`${prHtmlUrl}#comment-101`)
  })

  it('maps a general comment without inline', () => {
    const comment = mapBitbucketCommentToComment(
      generalComment,
      prHtmlUrl,
    )
    expect(comment.path).toBeUndefined()
    expect(comment.line).toBeUndefined()
    expect(comment.side).toBeUndefined()
  })

  it('maps parent.id to in_reply_to_id', () => {
    const comment = mapBitbucketCommentToComment(
      replyComment,
      prHtmlUrl,
    )
    expect(comment.in_reply_to_id).toBe(100)
  })

  it('sets in_reply_to_id to undefined when no parent', () => {
    const comment = mapBitbucketCommentToComment(
      generalComment,
      prHtmlUrl,
    )
    expect(comment.in_reply_to_id).toBeUndefined()
  })

  it('sets node_id to string of comment id', () => {
    const comment = mapBitbucketCommentToComment(
      generalComment,
      prHtmlUrl,
    )
    expect(comment.node_id).toBe('100')
  })

  it('maps timestamps', () => {
    const comment = mapBitbucketCommentToComment(
      generalComment,
      prHtmlUrl,
    )
    expect(comment.created_at).toBe('2026-01-15T10:00:00Z')
    expect(comment.updated_at).toBe('2026-01-15T10:00:00Z')
  })
})

// ---------------------------------------------------------------------------
// mapBitbucketCommentsToComments
// ---------------------------------------------------------------------------

describe('mapBitbucketCommentsToComments', () => {
  it('filters out deleted comments', () => {
    const comments = mapBitbucketCommentsToComments(
      [generalComment, deletedComment, inlineComment],
      prHtmlUrl,
    )
    expect(comments).toHaveLength(2)
    expect(comments.map((c) => c.id)).toEqual([100, 101])
  })

  it('returns empty array for all deleted comments', () => {
    const comments = mapBitbucketCommentsToComments(
      [deletedComment],
      prHtmlUrl,
    )
    expect(comments).toEqual([])
  })

  it('returns empty array for empty input', () => {
    const comments = mapBitbucketCommentsToComments([], prHtmlUrl)
    expect(comments).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// mapBitbucketCommentToIssueComment
// ---------------------------------------------------------------------------

describe('mapBitbucketCommentToIssueComment', () => {
  it('maps a general comment to IssueComment', () => {
    const ic = mapBitbucketCommentToIssueComment(
      generalComment,
      prHtmlUrl,
    )
    expect(ic.id).toBe(100)
    expect(ic.body).toBe('This looks great!')
    expect(ic.user.login).toBe('janedoe')
    expect(ic.html_url).toBe(`${prHtmlUrl}#comment-100`)
    expect(ic.created_at).toBe('2026-01-15T10:00:00Z')
    expect(ic.updated_at).toBe('2026-01-15T10:00:00Z')
  })
})

// ---------------------------------------------------------------------------
// mapBitbucketCommentsToIssueComments
// ---------------------------------------------------------------------------

describe('mapBitbucketCommentsToIssueComments', () => {
  it('excludes deleted comments and inline comments', () => {
    const ics = mapBitbucketCommentsToIssueComments(
      [generalComment, deletedComment, inlineComment, replyComment],
      prHtmlUrl,
    )
    expect(ics).toHaveLength(2)
    expect(ics[0].id).toBe(100)
    expect(ics[1].id).toBe(103)
  })

  it('returns empty array when all comments are inline', () => {
    const ics = mapBitbucketCommentsToIssueComments(
      [inlineComment],
      prHtmlUrl,
    )
    expect(ics).toEqual([])
  })

  it('returns empty array for empty input', () => {
    const ics = mapBitbucketCommentsToIssueComments([], prHtmlUrl)
    expect(ics).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// mapBitbucketDiffStatToFileChange
// ---------------------------------------------------------------------------

describe('mapBitbucketDiffStatToFileChange', () => {
  it('maps a modified file', () => {
    const fc = mapBitbucketDiffStatToFileChange(validDiffStat)
    expect(fc.filename).toBe('src/utils.ts')
    expect(fc.status).toBe('modified')
    expect(fc.additions).toBe(10)
    expect(fc.deletions).toBe(3)
    expect(fc.changes).toBe(13)
  })

  it('maps an added file', () => {
    const fc = mapBitbucketDiffStatToFileChange({
      status: 'added',
      old: null,
      new: { path: 'src/new-file.ts' },
      lines_added: 20,
      lines_removed: 0,
    })
    expect(fc.status).toBe('added')
    expect(fc.filename).toBe('src/new-file.ts')
  })

  it('maps a removed file', () => {
    const fc = mapBitbucketDiffStatToFileChange({
      status: 'removed',
      old: { path: 'src/deleted.ts' },
      new: null,
      lines_added: 0,
      lines_removed: 50,
    })
    expect(fc.status).toBe('removed')
    expect(fc.filename).toBe('src/deleted.ts')
  })

  it('maps a renamed file with previous_filename', () => {
    const fc = mapBitbucketDiffStatToFileChange({
      status: 'renamed',
      old: { path: 'src/old-name.ts' },
      new: { path: 'src/new-name.ts' },
      lines_added: 0,
      lines_removed: 0,
    })
    expect(fc.status).toBe('renamed')
    expect(fc.filename).toBe('src/new-name.ts')
    expect(fc.previous_filename).toBe('src/old-name.ts')
  })

  it('does not set previous_filename for non-renamed files', () => {
    const fc = mapBitbucketDiffStatToFileChange(validDiffStat)
    expect(fc.previous_filename).toBeUndefined()
  })

  it('maps merge conflict to modified', () => {
    const fc = mapBitbucketDiffStatToFileChange({
      ...validDiffStat,
      status: 'merge conflict',
    })
    expect(fc.status).toBe('modified')
  })

  it('sets sha to empty string', () => {
    const fc = mapBitbucketDiffStatToFileChange(validDiffStat)
    expect(fc.sha).toBe('')
  })

  it('handles both old and new being null gracefully', () => {
    const fc = mapBitbucketDiffStatToFileChange({
      status: 'modified',
      old: null,
      new: null,
      lines_added: 0,
      lines_removed: 0,
    })
    expect(fc.filename).toBe('')
  })
})

// ---------------------------------------------------------------------------
// mapBitbucketCommitToCommit
// ---------------------------------------------------------------------------

describe('mapBitbucketCommitToCommit', () => {
  it('maps hash to sha', () => {
    const commit = mapBitbucketCommitToCommit(bbCommit)
    expect(commit.sha).toBe('abc123def456')
  })

  it('maps message to commit.message', () => {
    const commit = mapBitbucketCommitToCommit(bbCommit)
    expect(commit.commit.message).toBe(
      'feat: add dark mode\n\nFull description here.',
    )
  })

  it('parses raw author into name and email', () => {
    const commit = mapBitbucketCommitToCommit(bbCommit)
    expect(commit.commit.author.name).toBe('Jane Doe')
    expect(commit.commit.author.email).toBe('jane@example.com')
  })

  it('handles raw author without email angle brackets', () => {
    const commit = mapBitbucketCommitToCommit({
      ...bbCommit,
      author: { raw: 'Jane Doe' },
    })
    expect(commit.commit.author.name).toBe('Jane Doe')
    expect(commit.commit.author.email).toBe('')
  })

  it('maps date to commit.author.date', () => {
    const commit = mapBitbucketCommitToCommit(bbCommit)
    expect(commit.commit.author.date).toBe('2026-01-15T10:00:00Z')
  })

  it('sets author to null when no user on commit', () => {
    const commit = mapBitbucketCommitToCommit(bbCommit)
    expect(commit.author).toBeNull()
  })

  it('maps linked user to author when present', () => {
    const commit = mapBitbucketCommitToCommit({
      ...bbCommit,
      author: { raw: 'Jane Doe <jane@example.com>', user: bbUser },
    })
    expect(commit.author).not.toBeNull()
    expect(commit.author?.login).toBe('janedoe')
  })

  it('maps html link to html_url', () => {
    const commit = mapBitbucketCommitToCommit({
      ...bbCommit,
      links: {
        html: { href: 'https://bitbucket.org/team/repo/commits/abc123' },
      },
    })
    expect(commit.html_url).toBe(
      'https://bitbucket.org/team/repo/commits/abc123',
    )
  })

  it('defaults html_url to empty string when no links', () => {
    const commit = mapBitbucketCommitToCommit(bbCommit)
    expect(commit.html_url).toBe('')
  })
})

// ---------------------------------------------------------------------------
// mapBitbucketPipelineStepToCheckRun
// ---------------------------------------------------------------------------

describe('mapBitbucketPipelineStepToCheckRun', () => {
  it('maps a completed successful step', () => {
    const cr = mapBitbucketPipelineStepToCheckRun(completedStep)
    expect(cr.status).toBe('completed')
    expect(cr.conclusion).toBe('success')
    expect(cr.name).toBe('Build & Test')
  })

  it('maps a completed failed step', () => {
    const cr = mapBitbucketPipelineStepToCheckRun({
      ...completedStep,
      state: { name: 'COMPLETED', result: { name: 'FAILED' } },
    })
    expect(cr.status).toBe('completed')
    expect(cr.conclusion).toBe('failure')
  })

  it('maps a completed error step to failure', () => {
    const cr = mapBitbucketPipelineStepToCheckRun({
      ...completedStep,
      state: { name: 'COMPLETED', result: { name: 'ERROR' } },
    })
    expect(cr.conclusion).toBe('failure')
  })

  it('maps a stopped step to cancelled', () => {
    const cr = mapBitbucketPipelineStepToCheckRun({
      ...completedStep,
      state: { name: 'COMPLETED', result: { name: 'STOPPED' } },
    })
    expect(cr.conclusion).toBe('cancelled')
  })

  it('maps an expired step to timed_out', () => {
    const cr = mapBitbucketPipelineStepToCheckRun({
      ...completedStep,
      state: { name: 'COMPLETED', result: { name: 'EXPIRED' } },
    })
    expect(cr.conclusion).toBe('timed_out')
  })

  it('maps a not_run step to skipped', () => {
    const cr = mapBitbucketPipelineStepToCheckRun({
      ...completedStep,
      state: { name: 'COMPLETED', result: { name: 'NOT_RUN' } },
    })
    expect(cr.conclusion).toBe('skipped')
  })

  it('maps IN_PROGRESS step to in_progress with null conclusion', () => {
    const cr = mapBitbucketPipelineStepToCheckRun({
      ...completedStep,
      state: { name: 'IN_PROGRESS' },
    })
    expect(cr.status).toBe('in_progress')
    expect(cr.conclusion).toBeNull()
  })

  it('maps PENDING step to queued with null conclusion', () => {
    const cr = mapBitbucketPipelineStepToCheckRun({
      ...completedStep,
      state: { name: 'PENDING' },
    })
    expect(cr.status).toBe('queued')
    expect(cr.conclusion).toBeNull()
  })

  it('maps PAUSED step to queued', () => {
    const cr = mapBitbucketPipelineStepToCheckRun({
      ...completedStep,
      state: { name: 'PAUSED' },
    })
    expect(cr.status).toBe('queued')
  })

  it('maps HALTED step to queued', () => {
    const cr = mapBitbucketPipelineStepToCheckRun({
      ...completedStep,
      state: { name: 'HALTED' },
    })
    expect(cr.status).toBe('queued')
  })

  it('uses step name when available', () => {
    const cr = mapBitbucketPipelineStepToCheckRun(completedStep)
    expect(cr.name).toBe('Build & Test')
  })

  it('falls back to uuid when no name', () => {
    const cr = mapBitbucketPipelineStepToCheckRun({
      ...completedStep,
      name: undefined,
    })
    expect(cr.name).toBe('{step-uuid-1}')
  })

  it('generates a stable numeric id from uuid', () => {
    const cr1 = mapBitbucketPipelineStepToCheckRun(completedStep)
    const cr2 = mapBitbucketPipelineStepToCheckRun(completedStep)
    expect(typeof cr1.id).toBe('number')
    expect(cr1.id).toBe(cr2.id)
  })

  it('sets html_url and details_url to null', () => {
    const cr = mapBitbucketPipelineStepToCheckRun(completedStep)
    expect(cr.html_url).toBeNull()
    expect(cr.details_url).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// mapBitbucketPipelineStepsToCheckRunsResponse
// ---------------------------------------------------------------------------

describe('mapBitbucketPipelineStepsToCheckRunsResponse', () => {
  it('wraps steps in a CheckRunsResponse', () => {
    const failedStep: BitbucketPipelineStep = {
      ...completedStep,
      uuid: '{step-uuid-2}',
      name: 'Lint',
      state: { name: 'COMPLETED', result: { name: 'FAILED' } },
    }
    const response = mapBitbucketPipelineStepsToCheckRunsResponse([
      completedStep,
      failedStep,
    ])
    expect(response.total_count).toBe(2)
    expect(response.check_runs).toHaveLength(2)
    expect(response.check_runs[0].conclusion).toBe('success')
    expect(response.check_runs[1].conclusion).toBe('failure')
  })

  it('returns empty response for no steps', () => {
    const response = mapBitbucketPipelineStepsToCheckRunsResponse([])
    expect(response.total_count).toBe(0)
    expect(response.check_runs).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// mapParticipantToReview
// ---------------------------------------------------------------------------

describe('mapParticipantToReview', () => {
  it('maps approved participant to APPROVED review', () => {
    const review = mapParticipantToReview(
      reviewerParticipant,
      prHtmlUrl,
      '2026-01-17T09:00:00Z',
    )
    expect(review.state).toBe('APPROVED')
    expect(review.user.login).toBe('janedoe')
    expect(review.submitted_at).toBe('2026-01-17T09:00:00Z')
    expect(review.html_url).toBe(prHtmlUrl)
    expect(review.body).toBeNull()
  })

  it('maps changes_requested participant', () => {
    const review = mapParticipantToReview(
      {
        ...reviewerParticipant,
        approved: false,
        state: 'changes_requested',
      },
      prHtmlUrl,
      '2026-01-17T09:00:00Z',
    )
    expect(review.state).toBe('CHANGES_REQUESTED')
  })

  it('maps non-approved participant to COMMENTED', () => {
    const review = mapParticipantToReview(
      {
        ...reviewerParticipant,
        approved: false,
        state: null,
      },
      prHtmlUrl,
      '2026-01-17T09:00:00Z',
    )
    expect(review.state).toBe('COMMENTED')
  })

  it('generates a stable id from user uuid', () => {
    const review = mapParticipantToReview(
      reviewerParticipant,
      prHtmlUrl,
      '2026-01-17T09:00:00Z',
    )
    expect(typeof review.id).toBe('number')
    expect(review.id).toBeGreaterThanOrEqual(0)
  })
})

// ---------------------------------------------------------------------------
// mapParticipantsToReviews
// ---------------------------------------------------------------------------

describe('mapParticipantsToReviews', () => {
  it('extracts only REVIEWER participants', () => {
    const participants: readonly BitbucketParticipant[] = [
      reviewerParticipant,
      {
        user: bbUserMinimal,
        role: 'AUTHOR',
        approved: false,
        state: null,
      },
      {
        user: { ...bbUser, uuid: '{reviewer-2}' },
        role: 'REVIEWER',
        approved: false,
        state: 'changes_requested',
      },
      {
        user: { ...bbUser, uuid: '{participant-1}' },
        role: 'PARTICIPANT',
        approved: false,
        state: null,
      },
    ]

    const reviews = mapParticipantsToReviews(
      participants,
      prHtmlUrl,
      '2026-01-17T09:00:00Z',
    )
    expect(reviews).toHaveLength(2)
    expect(reviews[0].state).toBe('APPROVED')
    expect(reviews[1].state).toBe('CHANGES_REQUESTED')
  })

  it('returns empty array when no reviewers', () => {
    const reviews = mapParticipantsToReviews(
      [
        {
          user: bbUser,
          role: 'AUTHOR',
          approved: false,
          state: null,
        },
      ],
      prHtmlUrl,
      '2026-01-17T09:00:00Z',
    )
    expect(reviews).toEqual([])
  })

  it('returns empty array for empty input', () => {
    const reviews = mapParticipantsToReviews(
      [],
      prHtmlUrl,
      '2026-01-17T09:00:00Z',
    )
    expect(reviews).toEqual([])
  })
})
