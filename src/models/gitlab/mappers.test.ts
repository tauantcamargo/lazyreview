import { describe, it, expect } from 'vitest'
import {
  mapGitLabUser,
  mapMergeRequestToPR,
  mapNoteToComment,
  mapNotesToComments,
  mapNoteToIssueComment,
  mapNotesToIssueComments,
  mapDiffToFileChange,
  mapCommit,
  mapPipelineJobToCheckRun,
  mapPipelineJobsToCheckRunsResponse,
  mapApprovalToReview,
} from './mappers'
import type { GitLabUser, GitLabMergeRequest } from './merge-request'
import type { GitLabNote } from './note'
import type { GitLabDiff } from './diff'
import type { GitLabCommit } from './commit'
import type { GitLabPipelineJob } from './pipeline'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const glUser: GitLabUser = {
  id: 1,
  username: 'janedoe',
  name: 'Jane Doe',
  avatar_url: 'https://gitlab.com/avatar.png',
  web_url: 'https://gitlab.com/janedoe',
}

const glUserNullAvatar: GitLabUser = {
  ...glUser,
  avatar_url: null,
}

const mrWebUrl = 'https://gitlab.com/project/-/merge_requests/42'

const minimalMR: GitLabMergeRequest = {
  id: 1001,
  iid: 42,
  title: 'Add dark mode',
  description: 'Implements dark mode toggle',
  state: 'opened',
  draft: false,
  source_branch: 'feature/dark-mode',
  target_branch: 'main',
  author: glUser,
  assignees: [],
  reviewers: [],
  labels: [],
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-01-16T12:00:00Z',
  sha: 'headsha123',
  web_url: mrWebUrl,
  user_notes_count: 0,
  has_conflicts: false,
}

const generalNote: GitLabNote = {
  id: 500,
  body: 'This looks great!',
  author: glUser,
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-01-15T10:00:00Z',
  system: false,
  resolvable: false,
  resolved: false,
}

const systemNote: GitLabNote = {
  ...generalNote,
  id: 501,
  body: 'merged branch into main',
  system: true,
}

const diffNote: GitLabNote = {
  ...generalNote,
  id: 502,
  body: 'Nit: rename this variable',
  resolvable: true,
  type: 'DiffNote',
  position: {
    base_sha: 'aaa',
    head_sha: 'bbb',
    start_sha: 'ccc',
    old_path: 'src/old.ts',
    new_path: 'src/new.ts',
    old_line: null,
    new_line: 15,
  },
}

const diffNoteOldSide: GitLabNote = {
  ...diffNote,
  id: 503,
  position: {
    ...diffNote.position!,
    old_line: 10,
    new_line: null,
  },
}

const validDiff: GitLabDiff = {
  old_path: 'src/utils.ts',
  new_path: 'src/utils.ts',
  a_mode: '100644',
  b_mode: '100644',
  diff: '@@ -1,3 +1,4 @@\n context\n-old line\n+new line\n+added line\n context2',
  new_file: false,
  renamed_file: false,
  deleted_file: false,
}

const glCommit: GitLabCommit = {
  id: 'abc123def456',
  short_id: 'abc123d',
  title: 'feat: add dark mode',
  message: 'feat: add dark mode\n\nFull description here.',
  author_name: 'Jane Doe',
  author_email: 'jane@example.com',
  authored_date: '2026-01-15T10:00:00Z',
  committed_date: '2026-01-15T10:05:00Z',
}

const successJob: GitLabPipelineJob = {
  id: 200,
  name: 'unit-tests',
  status: 'success',
  stage: 'test',
  web_url: 'https://gitlab.com/project/-/jobs/200',
  started_at: '2026-01-15T10:00:00Z',
  finished_at: '2026-01-15T10:05:00Z',
  allow_failure: false,
}

// ---------------------------------------------------------------------------
// mapGitLabUser
// ---------------------------------------------------------------------------

describe('mapGitLabUser', () => {
  it('maps username to login', () => {
    const user = mapGitLabUser(glUser)
    expect(user.login).toBe('janedoe')
  })

  it('maps web_url to html_url', () => {
    const user = mapGitLabUser(glUser)
    expect(user.html_url).toBe('https://gitlab.com/janedoe')
  })

  it('preserves id', () => {
    const user = mapGitLabUser(glUser)
    expect(user.id).toBe(1)
  })

  it('maps avatar_url, falling back to empty string for null', () => {
    const user = mapGitLabUser(glUserNullAvatar)
    expect(user.avatar_url).toBe('')
  })

  it('sets type to User', () => {
    const user = mapGitLabUser(glUser)
    expect(user.type).toBe('User')
  })
})

// ---------------------------------------------------------------------------
// mapMergeRequestToPR
// ---------------------------------------------------------------------------

describe('mapMergeRequestToPR', () => {
  it('maps iid to number', () => {
    const pr = mapMergeRequestToPR(minimalMR)
    expect(pr.number).toBe(42)
  })

  it('maps opened state to open', () => {
    const pr = mapMergeRequestToPR(minimalMR)
    expect(pr.state).toBe('open')
    expect(pr.merged).toBe(false)
  })

  it('maps closed state to closed', () => {
    const pr = mapMergeRequestToPR({ ...minimalMR, state: 'closed' })
    expect(pr.state).toBe('closed')
    expect(pr.merged).toBe(false)
  })

  it('maps merged state to closed with merged=true', () => {
    const pr = mapMergeRequestToPR({ ...minimalMR, state: 'merged' })
    expect(pr.state).toBe('closed')
    expect(pr.merged).toBe(true)
  })

  it('maps locked state to closed', () => {
    const pr = mapMergeRequestToPR({ ...minimalMR, state: 'locked' })
    expect(pr.state).toBe('closed')
  })

  it('maps source_branch to head.ref', () => {
    const pr = mapMergeRequestToPR(minimalMR)
    expect(pr.head.ref).toBe('feature/dark-mode')
  })

  it('maps sha to head.sha', () => {
    const pr = mapMergeRequestToPR(minimalMR)
    expect(pr.head.sha).toBe('headsha123')
  })

  it('maps target_branch to base.ref', () => {
    const pr = mapMergeRequestToPR(minimalMR)
    expect(pr.base.ref).toBe('main')
  })

  it('uses diff_refs.base_sha for base.sha when available', () => {
    const pr = mapMergeRequestToPR({
      ...minimalMR,
      diff_refs: { base_sha: 'basesha', head_sha: 'headsha', start_sha: 'start' },
    })
    expect(pr.base.sha).toBe('basesha')
  })

  it('defaults base.sha to empty string when no diff_refs', () => {
    const pr = mapMergeRequestToPR(minimalMR)
    expect(pr.base.sha).toBe('')
  })

  it('maps web_url to html_url', () => {
    const pr = mapMergeRequestToPR(minimalMR)
    expect(pr.html_url).toBe(mrWebUrl)
  })

  it('maps labels as string array to Label objects', () => {
    const pr = mapMergeRequestToPR({
      ...minimalMR,
      labels: ['bug', 'urgent'],
    })
    expect(pr.labels).toHaveLength(2)
    expect(pr.labels[0].name).toBe('bug')
    expect(pr.labels[0].color).toBe('')
    expect(pr.labels[1].name).toBe('urgent')
  })

  it('maps assignees', () => {
    const reviewer = { ...glUser, id: 2, username: 'reviewer1' }
    const pr = mapMergeRequestToPR({
      ...minimalMR,
      assignees: [glUser],
      reviewers: [reviewer],
    })
    expect(pr.assignees).toHaveLength(1)
    expect(pr.assignees[0].login).toBe('janedoe')
    expect(pr.requested_reviewers).toHaveLength(1)
    expect(pr.requested_reviewers[0].login).toBe('reviewer1')
  })

  it('maps null description to null body', () => {
    const pr = mapMergeRequestToPR({ ...minimalMR, description: null })
    expect(pr.body).toBeNull()
  })

  it('maps draft flag', () => {
    const pr = mapMergeRequestToPR({ ...minimalMR, draft: true })
    expect(pr.draft).toBe(true)
  })

  it('maps user_notes_count to comments', () => {
    const pr = mapMergeRequestToPR({ ...minimalMR, user_notes_count: 7 })
    expect(pr.comments).toBe(7)
  })

  it('maps has_conflicts to mergeable=false', () => {
    const pr = mapMergeRequestToPR({ ...minimalMR, has_conflicts: true })
    expect(pr.mergeable).toBe(false)
  })

  it('maps no conflicts to mergeable=null', () => {
    const pr = mapMergeRequestToPR({ ...minimalMR, has_conflicts: false })
    expect(pr.mergeable).toBeNull()
  })

  it('maps merge_status to mergeable_state', () => {
    const pr = mapMergeRequestToPR({
      ...minimalMR,
      merge_status: 'can_be_merged',
    })
    expect(pr.mergeable_state).toBe('can_be_merged')
  })

  it('maps merge_commit_sha', () => {
    const pr = mapMergeRequestToPR({
      ...minimalMR,
      merge_commit_sha: 'merge123',
    })
    expect(pr.merge_commit_sha).toBe('merge123')
  })

  it('maps timestamps', () => {
    const pr = mapMergeRequestToPR(minimalMR)
    expect(pr.created_at).toBe('2026-01-15T10:00:00Z')
    expect(pr.updated_at).toBe('2026-01-16T12:00:00Z')
  })

  it('maps merged_at and closed_at', () => {
    const pr = mapMergeRequestToPR({
      ...minimalMR,
      merged_at: '2026-01-17T08:00:00Z',
      closed_at: null,
    })
    expect(pr.merged_at).toBe('2026-01-17T08:00:00Z')
    expect(pr.closed_at).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// mapNoteToComment
// ---------------------------------------------------------------------------

describe('mapNoteToComment', () => {
  it('maps a diff note to a Comment with path and line', () => {
    const comment = mapNoteToComment(diffNote, mrWebUrl)
    expect(comment.id).toBe(502)
    expect(comment.body).toBe('Nit: rename this variable')
    expect(comment.user.login).toBe('janedoe')
    expect(comment.path).toBe('src/new.ts')
    expect(comment.line).toBe(15)
    expect(comment.side).toBe('RIGHT')
  })

  it('maps a note on the old side to LEFT', () => {
    const comment = mapNoteToComment(diffNoteOldSide, mrWebUrl)
    expect(comment.line).toBe(10)
    expect(comment.side).toBe('LEFT')
  })

  it('constructs html_url from MR URL and note id', () => {
    const comment = mapNoteToComment(diffNote, mrWebUrl)
    expect(comment.html_url).toBe(`${mrWebUrl}#note_502`)
  })

  it('maps a general note without position', () => {
    const comment = mapNoteToComment(generalNote, mrWebUrl)
    expect(comment.path).toBeUndefined()
    expect(comment.line).toBeUndefined()
    expect(comment.side).toBeUndefined()
  })

  it('sets node_id to string of note id', () => {
    const comment = mapNoteToComment(generalNote, mrWebUrl)
    expect(comment.node_id).toBe('500')
  })
})

// ---------------------------------------------------------------------------
// mapNotesToComments
// ---------------------------------------------------------------------------

describe('mapNotesToComments', () => {
  it('filters out system notes', () => {
    const comments = mapNotesToComments(
      [generalNote, systemNote, diffNote],
      mrWebUrl,
    )
    expect(comments).toHaveLength(2)
    expect(comments.map((c) => c.id)).toEqual([500, 502])
  })

  it('returns empty array for all system notes', () => {
    const comments = mapNotesToComments([systemNote], mrWebUrl)
    expect(comments).toEqual([])
  })

  it('returns empty array for empty input', () => {
    const comments = mapNotesToComments([], mrWebUrl)
    expect(comments).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// mapNoteToIssueComment
// ---------------------------------------------------------------------------

describe('mapNoteToIssueComment', () => {
  it('maps a general note to IssueComment', () => {
    const ic = mapNoteToIssueComment(generalNote, mrWebUrl)
    expect(ic.id).toBe(500)
    expect(ic.body).toBe('This looks great!')
    expect(ic.user.login).toBe('janedoe')
    expect(ic.html_url).toBe(`${mrWebUrl}#note_500`)
    expect(ic.created_at).toBe('2026-01-15T10:00:00Z')
    expect(ic.updated_at).toBe('2026-01-15T10:00:00Z')
  })
})

// ---------------------------------------------------------------------------
// mapNotesToIssueComments
// ---------------------------------------------------------------------------

describe('mapNotesToIssueComments', () => {
  it('excludes system notes and diff notes', () => {
    const ics = mapNotesToIssueComments(
      [generalNote, systemNote, diffNote],
      mrWebUrl,
    )
    expect(ics).toHaveLength(1)
    expect(ics[0].id).toBe(500)
  })

  it('returns empty array when all notes have positions', () => {
    const ics = mapNotesToIssueComments([diffNote], mrWebUrl)
    expect(ics).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// mapDiffToFileChange
// ---------------------------------------------------------------------------

describe('mapDiffToFileChange', () => {
  it('maps a modified file diff', () => {
    const fc = mapDiffToFileChange(validDiff)
    expect(fc.filename).toBe('src/utils.ts')
    expect(fc.status).toBe('modified')
    expect(fc.additions).toBe(2)
    expect(fc.deletions).toBe(1)
    expect(fc.changes).toBe(3)
    expect(fc.patch).toBe(validDiff.diff)
  })

  it('maps a new file diff', () => {
    const fc = mapDiffToFileChange({ ...validDiff, new_file: true })
    expect(fc.status).toBe('added')
  })

  it('maps a deleted file diff', () => {
    const fc = mapDiffToFileChange({ ...validDiff, deleted_file: true })
    expect(fc.status).toBe('removed')
  })

  it('maps a renamed file diff with previous_filename', () => {
    const fc = mapDiffToFileChange({
      ...validDiff,
      old_path: 'src/old-name.ts',
      new_path: 'src/new-name.ts',
      renamed_file: true,
    })
    expect(fc.status).toBe('renamed')
    expect(fc.filename).toBe('src/new-name.ts')
    expect(fc.previous_filename).toBe('src/old-name.ts')
  })

  it('does not set previous_filename for non-renamed files', () => {
    const fc = mapDiffToFileChange(validDiff)
    expect(fc.previous_filename).toBeUndefined()
  })

  it('counts additions and deletions correctly from patch', () => {
    const diff: GitLabDiff = {
      ...validDiff,
      diff: '@@ -1,5 +1,7 @@\n context\n+add1\n+add2\n+add3\n-del1\n-del2\n context',
    }
    const fc = mapDiffToFileChange(diff)
    expect(fc.additions).toBe(3)
    expect(fc.deletions).toBe(2)
    expect(fc.changes).toBe(5)
  })

  it('ignores --- and +++ header lines in line count', () => {
    const diff: GitLabDiff = {
      ...validDiff,
      diff: '--- a/src/file.ts\n+++ b/src/file.ts\n@@ -1,2 +1,2 @@\n-old\n+new',
    }
    const fc = mapDiffToFileChange(diff)
    expect(fc.additions).toBe(1)
    expect(fc.deletions).toBe(1)
  })

  it('handles empty diff content', () => {
    const fc = mapDiffToFileChange({ ...validDiff, diff: '' })
    expect(fc.additions).toBe(0)
    expect(fc.deletions).toBe(0)
    expect(fc.changes).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// mapCommit
// ---------------------------------------------------------------------------

describe('mapCommit', () => {
  it('maps id to sha', () => {
    const commit = mapCommit(glCommit)
    expect(commit.sha).toBe('abc123def456')
  })

  it('maps message to commit.message', () => {
    const commit = mapCommit(glCommit)
    expect(commit.commit.message).toBe(
      'feat: add dark mode\n\nFull description here.',
    )
  })

  it('maps author_name and author_email to commit.author', () => {
    const commit = mapCommit(glCommit)
    expect(commit.commit.author.name).toBe('Jane Doe')
    expect(commit.commit.author.email).toBe('jane@example.com')
    expect(commit.commit.author.date).toBe('2026-01-15T10:00:00Z')
  })

  it('sets author to null (no mapped GitHub user)', () => {
    const commit = mapCommit(glCommit)
    expect(commit.author).toBeNull()
  })

  it('uses web_url from commit when available', () => {
    const commit = mapCommit({
      ...glCommit,
      web_url: 'https://gitlab.com/project/-/commit/abc123',
    })
    expect(commit.html_url).toBe(
      'https://gitlab.com/project/-/commit/abc123',
    )
  })

  it('constructs html_url from repoWebUrl when no web_url on commit', () => {
    const commit = mapCommit(
      glCommit,
      'https://gitlab.com/group/project',
    )
    expect(commit.html_url).toBe(
      'https://gitlab.com/group/project/-/commit/abc123def456',
    )
  })

  it('falls back to empty string html_url when no URLs available', () => {
    const commit = mapCommit(glCommit)
    expect(commit.html_url).toBe('')
  })
})

// ---------------------------------------------------------------------------
// mapPipelineJobToCheckRun
// ---------------------------------------------------------------------------

describe('mapPipelineJobToCheckRun', () => {
  it('maps success job to completed/success', () => {
    const cr = mapPipelineJobToCheckRun(successJob)
    expect(cr.status).toBe('completed')
    expect(cr.conclusion).toBe('success')
  })

  it('formats name as stage / name', () => {
    const cr = mapPipelineJobToCheckRun(successJob)
    expect(cr.name).toBe('test / unit-tests')
  })

  it('maps failed job to completed/failure', () => {
    const cr = mapPipelineJobToCheckRun({ ...successJob, status: 'failed' })
    expect(cr.status).toBe('completed')
    expect(cr.conclusion).toBe('failure')
  })

  it('maps failed with allow_failure to completed/neutral', () => {
    const cr = mapPipelineJobToCheckRun({
      ...successJob,
      status: 'failed',
      allow_failure: true,
    })
    expect(cr.status).toBe('completed')
    expect(cr.conclusion).toBe('neutral')
  })

  it('maps canceled job to completed/cancelled', () => {
    const cr = mapPipelineJobToCheckRun({ ...successJob, status: 'canceled' })
    expect(cr.status).toBe('completed')
    expect(cr.conclusion).toBe('cancelled')
  })

  it('maps skipped job to completed/skipped', () => {
    const cr = mapPipelineJobToCheckRun({ ...successJob, status: 'skipped' })
    expect(cr.status).toBe('completed')
    expect(cr.conclusion).toBe('skipped')
  })

  it('maps manual job to queued/action_required', () => {
    const cr = mapPipelineJobToCheckRun({ ...successJob, status: 'manual' })
    expect(cr.status).toBe('queued')
    expect(cr.conclusion).toBe('action_required')
  })

  it('maps running job to in_progress with null conclusion', () => {
    const cr = mapPipelineJobToCheckRun({ ...successJob, status: 'running' })
    expect(cr.status).toBe('in_progress')
    expect(cr.conclusion).toBeNull()
  })

  it('maps pending job to queued with null conclusion', () => {
    const cr = mapPipelineJobToCheckRun({ ...successJob, status: 'pending' })
    expect(cr.status).toBe('queued')
    expect(cr.conclusion).toBeNull()
  })

  it('maps created job to queued with null conclusion', () => {
    const cr = mapPipelineJobToCheckRun({ ...successJob, status: 'created' })
    expect(cr.status).toBe('queued')
    expect(cr.conclusion).toBeNull()
  })

  it('preserves web_url as html_url', () => {
    const cr = mapPipelineJobToCheckRun(successJob)
    expect(cr.html_url).toBe('https://gitlab.com/project/-/jobs/200')
  })

  it('preserves id', () => {
    const cr = mapPipelineJobToCheckRun(successJob)
    expect(cr.id).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// mapPipelineJobsToCheckRunsResponse
// ---------------------------------------------------------------------------

describe('mapPipelineJobsToCheckRunsResponse', () => {
  it('wraps jobs in a CheckRunsResponse', () => {
    const response = mapPipelineJobsToCheckRunsResponse([
      successJob,
      { ...successJob, id: 201, name: 'lint', status: 'failed' },
    ])
    expect(response.total_count).toBe(2)
    expect(response.check_runs).toHaveLength(2)
    expect(response.check_runs[0].conclusion).toBe('success')
    expect(response.check_runs[1].conclusion).toBe('failure')
  })

  it('returns empty response for no jobs', () => {
    const response = mapPipelineJobsToCheckRunsResponse([])
    expect(response.total_count).toBe(0)
    expect(response.check_runs).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// mapApprovalToReview
// ---------------------------------------------------------------------------

describe('mapApprovalToReview', () => {
  it('creates an APPROVED review from user data', () => {
    const review = mapApprovalToReview(
      glUser,
      '2026-01-17T09:00:00Z',
      mrWebUrl,
    )
    expect(review.state).toBe('APPROVED')
    expect(review.user.login).toBe('janedoe')
    expect(review.submitted_at).toBe('2026-01-17T09:00:00Z')
    expect(review.html_url).toBe(mrWebUrl)
    expect(review.body).toBeNull()
  })

  it('uses glUser.id as review id', () => {
    const review = mapApprovalToReview(glUser, '2026-01-17T09:00:00Z', mrWebUrl)
    expect(review.id).toBe(1)
  })
})
