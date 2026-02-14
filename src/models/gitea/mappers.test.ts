import { describe, it, expect } from 'vitest'
import {
  mapGiteaUser,
  mapGiteaPRToPullRequest,
  mapGiteaReviewCommentToComment,
  mapGiteaReviewCommentsToComments,
  mapGiteaIssueCommentToIssueComment,
  mapGiteaIssueCommentsToIssueComments,
  mapGiteaReviewToReview,
  mapGiteaReviewsToReviews,
  mapGiteaChangedFileToFileChange,
  mapGiteaChangedFilesToFileChanges,
  mapGiteaCommitToCommit,
  mapGiteaCommitsToCommits,
} from './mappers'
import type { GiteaUser, GiteaPullRequest } from './pull-request'
import type { GiteaReviewComment, GiteaIssueComment } from './comment'
import type { GiteaReview } from './review'
import type { GiteaChangedFile } from './diff'
import type { GiteaCommit } from './commit'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const giteaUser: GiteaUser = {
  id: 1,
  login: 'janedoe',
  full_name: 'Jane Doe',
  avatar_url: 'https://gitea.example.com/avatars/1',
}

const giteaUserMinimal: GiteaUser = {
  id: 2,
  login: 'john',
  full_name: '',
  avatar_url: '',
}

const minimalPR: GiteaPullRequest = {
  number: 42,
  title: 'Add dark mode',
  body: 'Implements dark mode toggle',
  state: 'open',
  is_locked: false,
  user: giteaUser,
  labels: [{ name: 'enhancement', color: '00ff00' }],
  assignees: [giteaUser],
  requested_reviewers: [giteaUserMinimal],
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-01-16T12:00:00Z',
  merged: false,
  head: {
    label: 'janedoe:feature',
    ref: 'feature',
    sha: 'abc123',
  },
  base: {
    label: 'main',
    ref: 'main',
    sha: 'def456',
  },
  html_url: 'https://gitea.example.com/janedoe/repo/pulls/42',
  diff_url: 'https://gitea.example.com/janedoe/repo/pulls/42.diff',
  comments: 3,
}

const reviewComment: GiteaReviewComment = {
  id: 200,
  body: 'Nit: rename this variable',
  user: giteaUser,
  path: 'src/main.ts',
  line: 42,
  old_line_num: 0,
  new_line_num: 42,
  diff_hunk: '@@ -40,6 +40,8 @@',
  pull_request_review_id: 10,
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-01-15T10:00:00Z',
  html_url: 'https://gitea.example.com/owner/repo/pulls/1#issuecomment-200',
  commit_id: 'abc123',
  original_commit_id: 'abc123',
}

const issueComment: GiteaIssueComment = {
  id: 100,
  body: 'This looks great!',
  user: giteaUser,
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-01-15T10:00:00Z',
  html_url: 'https://gitea.example.com/owner/repo/issues/1#issuecomment-100',
}

// ---------------------------------------------------------------------------
// User mapper
// ---------------------------------------------------------------------------

describe('mapGiteaUser', () => {
  it('maps a Gitea user to normalized User', () => {
    const user = mapGiteaUser(giteaUser)
    expect(user.login).toBe('janedoe')
    expect(user.id).toBe(1)
    expect(user.avatar_url).toBe('https://gitea.example.com/avatars/1')
    expect(user.type).toBe('User')
  })

  it('handles minimal user (empty avatar)', () => {
    const user = mapGiteaUser(giteaUserMinimal)
    expect(user.login).toBe('john')
    expect(user.id).toBe(2)
    expect(user.avatar_url).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Pull Request mapper
// ---------------------------------------------------------------------------

describe('mapGiteaPRToPullRequest', () => {
  it('maps an open PR', () => {
    const pr = mapGiteaPRToPullRequest(minimalPR)
    expect(pr.number).toBe(42)
    expect(pr.title).toBe('Add dark mode')
    expect(pr.body).toBe('Implements dark mode toggle')
    expect(pr.state).toBe('open')
    expect(pr.draft).toBe(false)
    expect(pr.merged).toBe(false)
    expect(pr.user.login).toBe('janedoe')
    expect(pr.head.ref).toBe('feature')
    expect(pr.head.sha).toBe('abc123')
    expect(pr.base.ref).toBe('main')
    expect(pr.base.sha).toBe('def456')
    expect(pr.html_url).toBe('https://gitea.example.com/janedoe/repo/pulls/42')
    expect(pr.comments).toBe(3)
    expect(pr.merged_at).toBeNull()
    expect(pr.closed_at).toBeNull()
  })

  it('maps a merged PR', () => {
    const mergedPR: GiteaPullRequest = {
      ...minimalPR,
      state: 'closed',
      merged: true,
    }
    const pr = mapGiteaPRToPullRequest(mergedPR)
    expect(pr.state).toBe('closed')
    expect(pr.merged).toBe(true)
    expect(pr.merged_at).toBe('2026-01-16T12:00:00Z')
    expect(pr.closed_at).toBeNull()
  })

  it('maps a closed (not merged) PR', () => {
    const closedPR: GiteaPullRequest = {
      ...minimalPR,
      state: 'closed',
      merged: false,
    }
    const pr = mapGiteaPRToPullRequest(closedPR)
    expect(pr.state).toBe('closed')
    expect(pr.merged).toBe(false)
    expect(pr.merged_at).toBeNull()
    expect(pr.closed_at).toBe('2026-01-16T12:00:00Z')
  })

  it('maps labels', () => {
    const pr = mapGiteaPRToPullRequest(minimalPR)
    expect(pr.labels).toHaveLength(1)
    expect(pr.labels[0]?.name).toBe('enhancement')
    expect(pr.labels[0]?.color).toBe('00ff00')
  })

  it('maps assignees and requested reviewers', () => {
    const pr = mapGiteaPRToPullRequest(minimalPR)
    expect(pr.assignees).toHaveLength(1)
    expect(pr.assignees[0]?.login).toBe('janedoe')
    expect(pr.requested_reviewers).toHaveLength(1)
    expect(pr.requested_reviewers[0]?.login).toBe('john')
  })

  it('handles null body', () => {
    const pr = mapGiteaPRToPullRequest({ ...minimalPR, body: null })
    expect(pr.body).toBeNull()
  })

  it('handles empty body', () => {
    const pr = mapGiteaPRToPullRequest({ ...minimalPR, body: '' })
    expect(pr.body).toBeNull()
  })

  it('maps mergeable flag', () => {
    const pr = mapGiteaPRToPullRequest({ ...minimalPR, mergeable: true })
    expect(pr.mergeable).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Review comment mapper
// ---------------------------------------------------------------------------

describe('mapGiteaReviewCommentToComment', () => {
  it('maps a RIGHT-side comment', () => {
    const comment = mapGiteaReviewCommentToComment(reviewComment)
    expect(comment.id).toBe(200)
    expect(comment.body).toBe('Nit: rename this variable')
    expect(comment.user.login).toBe('janedoe')
    expect(comment.path).toBe('src/main.ts')
    expect(comment.line).toBe(42)
    expect(comment.side).toBe('RIGHT')
  })

  it('maps a LEFT-side comment (old line only)', () => {
    const leftComment: GiteaReviewComment = {
      ...reviewComment,
      old_line_num: 10,
      new_line_num: 0,
    }
    const comment = mapGiteaReviewCommentToComment(leftComment)
    expect(comment.side).toBe('LEFT')
    expect(comment.line).toBe(10)
  })

  it('defaults to RIGHT side when both lines are set', () => {
    const bothLines: GiteaReviewComment = {
      ...reviewComment,
      old_line_num: 10,
      new_line_num: 15,
    }
    const comment = mapGiteaReviewCommentToComment(bothLines)
    expect(comment.side).toBe('RIGHT')
    expect(comment.line).toBe(15)
  })
})

describe('mapGiteaReviewCommentsToComments', () => {
  it('maps multiple comments', () => {
    const comments = mapGiteaReviewCommentsToComments([
      reviewComment,
      { ...reviewComment, id: 201, body: 'Another comment' },
    ])
    expect(comments).toHaveLength(2)
    expect(comments[0]?.id).toBe(200)
    expect(comments[1]?.id).toBe(201)
  })

  it('returns empty array for empty input', () => {
    expect(mapGiteaReviewCommentsToComments([])).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Issue comment mapper
// ---------------------------------------------------------------------------

describe('mapGiteaIssueCommentToIssueComment', () => {
  it('maps an issue comment', () => {
    const comment = mapGiteaIssueCommentToIssueComment(issueComment)
    expect(comment.id).toBe(100)
    expect(comment.body).toBe('This looks great!')
    expect(comment.user.login).toBe('janedoe')
    expect(comment.html_url).toBe(
      'https://gitea.example.com/owner/repo/issues/1#issuecomment-100',
    )
  })
})

describe('mapGiteaIssueCommentsToIssueComments', () => {
  it('maps multiple issue comments', () => {
    const comments = mapGiteaIssueCommentsToIssueComments([
      issueComment,
      { ...issueComment, id: 101, body: 'Another one' },
    ])
    expect(comments).toHaveLength(2)
  })

  it('returns empty array for empty input', () => {
    expect(mapGiteaIssueCommentsToIssueComments([])).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Review mapper
// ---------------------------------------------------------------------------

describe('mapGiteaReviewToReview', () => {
  it('maps an APPROVED review', () => {
    const giteaReview: GiteaReview = {
      id: 10,
      user: giteaUser,
      body: 'LGTM!',
      state: 'APPROVED',
      submitted_at: '2026-01-15T10:00:00Z',
      html_url: 'https://gitea.example.com/review/10',
      commit_id: 'abc123',
    }
    const review = mapGiteaReviewToReview(giteaReview)
    expect(review.id).toBe(10)
    expect(review.user.login).toBe('janedoe')
    expect(review.body).toBe('LGTM!')
    expect(review.state).toBe('APPROVED')
    expect(review.submitted_at).toBe('2026-01-15T10:00:00Z')
  })

  it('maps REQUEST_CHANGES to CHANGES_REQUESTED', () => {
    const review = mapGiteaReviewToReview({
      id: 11,
      user: giteaUser,
      body: 'Please fix',
      state: 'REQUEST_CHANGES',
      html_url: '',
      commit_id: '',
    })
    expect(review.state).toBe('CHANGES_REQUESTED')
  })

  it('maps PENDING state', () => {
    const review = mapGiteaReviewToReview({
      id: 12,
      user: giteaUser,
      body: '',
      state: 'PENDING',
      html_url: '',
      commit_id: '',
    })
    expect(review.state).toBe('PENDING')
  })

  it('maps COMMENT state to COMMENTED', () => {
    const review = mapGiteaReviewToReview({
      id: 13,
      user: giteaUser,
      body: 'Note',
      state: 'COMMENT',
      html_url: '',
      commit_id: '',
    })
    expect(review.state).toBe('COMMENTED')
  })

  it('maps REQUEST_REVIEW state to COMMENTED', () => {
    const review = mapGiteaReviewToReview({
      id: 14,
      user: giteaUser,
      body: '',
      state: 'REQUEST_REVIEW',
      html_url: '',
      commit_id: '',
    })
    expect(review.state).toBe('COMMENTED')
  })

  it('maps unknown state to COMMENTED', () => {
    const review = mapGiteaReviewToReview({
      id: 15,
      user: giteaUser,
      body: '',
      state: 'UNKNOWN_STATE',
      html_url: '',
      commit_id: '',
    })
    expect(review.state).toBe('COMMENTED')
  })

  it('handles null body as null', () => {
    const review = mapGiteaReviewToReview({
      id: 16,
      user: giteaUser,
      body: null,
      state: 'APPROVED',
      html_url: '',
      commit_id: '',
    })
    expect(review.body).toBeNull()
  })
})

describe('mapGiteaReviewsToReviews', () => {
  it('maps multiple reviews', () => {
    const reviews = mapGiteaReviewsToReviews([
      { id: 10, user: giteaUser, body: '', state: 'APPROVED', html_url: '', commit_id: '' },
      { id: 11, user: giteaUser, body: '', state: 'COMMENT', html_url: '', commit_id: '' },
    ])
    expect(reviews).toHaveLength(2)
    expect(reviews[0]?.state).toBe('APPROVED')
    expect(reviews[1]?.state).toBe('COMMENTED')
  })
})

// ---------------------------------------------------------------------------
// Changed file mapper
// ---------------------------------------------------------------------------

describe('mapGiteaChangedFileToFileChange', () => {
  it('maps a modified file', () => {
    const giteaFile: GiteaChangedFile = {
      filename: 'src/main.ts',
      status: 'modified',
      additions: 10,
      deletions: 3,
      changes: 13,
      html_url: '',
      contents_url: '',
    }
    const fileChange = mapGiteaChangedFileToFileChange(giteaFile)
    expect(fileChange.filename).toBe('src/main.ts')
    expect(fileChange.status).toBe('modified')
    expect(fileChange.additions).toBe(10)
    expect(fileChange.deletions).toBe(3)
    expect(fileChange.changes).toBe(13)
  })

  it('maps added status', () => {
    const fileChange = mapGiteaChangedFileToFileChange({
      filename: 'new.ts',
      status: 'added',
      html_url: '',
      contents_url: '',
    })
    expect(fileChange.status).toBe('added')
  })

  it('maps removed status', () => {
    const fileChange = mapGiteaChangedFileToFileChange({
      filename: 'old.ts',
      status: 'removed',
      html_url: '',
      contents_url: '',
    })
    expect(fileChange.status).toBe('removed')
  })

  it('maps renamed status with previous_filename', () => {
    const fileChange = mapGiteaChangedFileToFileChange({
      filename: 'new-name.ts',
      status: 'renamed',
      previous_filename: 'old-name.ts',
      html_url: '',
      contents_url: '',
    })
    expect(fileChange.status).toBe('renamed')
    expect(fileChange.previous_filename).toBe('old-name.ts')
  })

  it('maps unknown status to modified', () => {
    const fileChange = mapGiteaChangedFileToFileChange({
      filename: 'test.ts',
      status: 'something-unexpected',
      html_url: '',
      contents_url: '',
    })
    expect(fileChange.status).toBe('modified')
  })
})

describe('mapGiteaChangedFilesToFileChanges', () => {
  it('maps multiple files', () => {
    const files = mapGiteaChangedFilesToFileChanges([
      { filename: 'a.ts', status: 'added', html_url: '', contents_url: '' },
      { filename: 'b.ts', status: 'modified', html_url: '', contents_url: '' },
    ])
    expect(files).toHaveLength(2)
    expect(files[0]?.status).toBe('added')
    expect(files[1]?.status).toBe('modified')
  })

  it('returns empty array for empty input', () => {
    expect(mapGiteaChangedFilesToFileChanges([])).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Commit mapper
// ---------------------------------------------------------------------------

describe('mapGiteaCommitToCommit', () => {
  it('maps a commit with author', () => {
    const giteaCommit: GiteaCommit = {
      sha: 'abc123',
      commit: {
        message: 'feat: add feature',
        author: {
          name: 'Jane Doe',
          email: 'jane@example.com',
          date: '2026-01-15T10:00:00Z',
        },
      },
      author: giteaUser,
      html_url: 'https://gitea.example.com/commit/abc123',
    }
    const commit = mapGiteaCommitToCommit(giteaCommit)
    expect(commit.sha).toBe('abc123')
    expect(commit.commit.message).toBe('feat: add feature')
    expect(commit.commit.author.name).toBe('Jane Doe')
    expect(commit.commit.author.email).toBe('jane@example.com')
    expect(commit.commit.author.date).toBe('2026-01-15T10:00:00Z')
    expect(commit.author?.login).toBe('janedoe')
    expect(commit.html_url).toBe('https://gitea.example.com/commit/abc123')
  })

  it('handles null author', () => {
    const giteaCommit: GiteaCommit = {
      sha: 'def456',
      commit: {
        message: 'chore: update',
        author: {
          name: 'Bot',
          email: 'bot@example.com',
          date: '2026-01-15T10:00:00Z',
        },
      },
      author: null,
      html_url: '',
    }
    const commit = mapGiteaCommitToCommit(giteaCommit)
    expect(commit.author).toBeNull()
  })
})

describe('mapGiteaCommitsToCommits', () => {
  it('maps multiple commits', () => {
    const commits = mapGiteaCommitsToCommits([
      {
        sha: 'a1',
        commit: {
          message: 'first',
          author: { name: 'A', email: 'a@e.com', date: '2026-01-15T10:00:00Z' },
        },
        author: giteaUser,
        html_url: '',
      },
      {
        sha: 'a2',
        commit: {
          message: 'second',
          author: { name: 'B', email: 'b@e.com', date: '2026-01-16T10:00:00Z' },
        },
        author: null,
        html_url: '',
      },
    ])
    expect(commits).toHaveLength(2)
    expect(commits[0]?.sha).toBe('a1')
    expect(commits[1]?.sha).toBe('a2')
    expect(commits[1]?.author).toBeNull()
  })

  it('returns empty array for empty input', () => {
    expect(mapGiteaCommitsToCommits([])).toEqual([])
  })
})
