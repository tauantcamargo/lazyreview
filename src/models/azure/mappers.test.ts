import { describe, it, expect } from 'vitest'
import {
  mapAzureIdentity,
  mapAzureReviewerToReview,
  mapAzureReviewersToReviews,
  mapAzurePRToPullRequest,
  mapAzureCommentToComment,
  mapAzureThreadsToComments,
  mapAzureThreadsToIssueComments,
  mapAzureChangeToFileChange,
  mapAzureCommitToCommit,
  mapAzureBuildToCheckRun,
  mapAzureBuildsToCheckRunsResponse,
} from './mappers'
import type { AzureIdentity, AzureReviewer, AzurePullRequest } from './pull-request'
import type { AzureThread, AzureComment as AzureCommentType } from './comment'
import type { AzureIterationChange } from './diff'
import type { AzureBuild } from './build'
import type { AzureCommit } from './commit'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseUrl = 'https://dev.azure.com'
const org = 'myorg'
const project = 'myproject'
const repoName = 'myrepo'
const prHtmlUrl = `${baseUrl}/${org}/${project}/_git/${repoName}/pullrequest/42`

const validIdentity: AzureIdentity = {
  id: 'abc-123-def',
  displayName: 'Jane Doe',
  uniqueName: 'jane@example.com',
  imageUrl: 'https://dev.azure.com/_api/_common/identityImage?id=abc-123-def',
  url: 'https://dev.azure.com/org/_apis/Identities/abc-123-def',
}

const minimalIdentity: AzureIdentity = {
  id: 'xyz-789-uvw',
  displayName: 'John Smith',
}

const validReviewer: AzureReviewer = {
  id: 'reviewer-1',
  displayName: 'Bob Smith',
  uniqueName: 'bob@example.com',
  vote: 10,
  isRequired: true,
  hasDeclined: false,
  isFlagged: false,
}

const minimalPR: AzurePullRequest = {
  pullRequestId: 42,
  title: 'Add dark mode',
  description: 'Implements dark mode toggle',
  status: 'active',
  createdBy: validIdentity,
  creationDate: '2026-01-15T10:00:00Z',
  sourceRefName: 'refs/heads/feature/dark-mode',
  targetRefName: 'refs/heads/main',
  reviewers: [],
  labels: [],
  isDraft: false,
}

const validAuthor: AzureCommentType['author'] = {
  id: 'author-1',
  displayName: 'Jane Doe',
  uniqueName: 'jane@example.com',
}

const textComment: AzureCommentType = {
  id: 1,
  content: 'This looks great!',
  publishedDate: '2026-01-15T10:00:00Z',
  lastUpdatedDate: '2026-01-15T10:00:00Z',
  commentType: 'text',
  parentCommentId: 0,
  author: validAuthor,
}

const replyComment: AzureCommentType = {
  ...textComment,
  id: 2,
  content: 'Thanks for the feedback!',
  parentCommentId: 1,
}

const systemComment: AzureCommentType = {
  ...textComment,
  id: 3,
  content: 'Updated the pull request status',
  commentType: 'system',
}

const inlineThread: AzureThread = {
  id: 100,
  publishedDate: '2026-01-15T10:00:00Z',
  lastUpdatedDate: '2026-01-15T10:00:00Z',
  comments: [textComment],
  status: 'active',
  isDeleted: false,
  threadContext: {
    filePath: '/src/utils.ts',
    rightFileStart: { line: 15, offset: 1 },
    rightFileEnd: { line: 15, offset: 1 },
  },
}

const leftSideThread: AzureThread = {
  ...inlineThread,
  id: 101,
  threadContext: {
    filePath: '/src/old.ts',
    leftFileStart: { line: 10, offset: 1 },
    leftFileEnd: { line: 10, offset: 1 },
  },
}

const generalThread: AzureThread = {
  id: 200,
  publishedDate: '2026-01-15T10:00:00Z',
  lastUpdatedDate: '2026-01-15T10:00:00Z',
  comments: [textComment, replyComment],
  status: 'active',
  isDeleted: false,
}

const systemThread: AzureThread = {
  id: 300,
  publishedDate: '2026-01-15T10:00:00Z',
  lastUpdatedDate: '2026-01-15T10:00:00Z',
  comments: [systemComment],
  status: 'active',
  isDeleted: false,
}

const deletedThread: AzureThread = {
  ...generalThread,
  id: 400,
  isDeleted: true,
}

// ---------------------------------------------------------------------------
// mapAzureIdentity
// ---------------------------------------------------------------------------

describe('mapAzureIdentity', () => {
  it('maps uniqueName to login', () => {
    const user = mapAzureIdentity(validIdentity)
    expect(user.login).toBe('jane@example.com')
  })

  it('falls back to displayName when no uniqueName', () => {
    const user = mapAzureIdentity(minimalIdentity)
    expect(user.login).toBe('John Smith')
  })

  it('maps imageUrl to avatar_url', () => {
    const user = mapAzureIdentity(validIdentity)
    expect(user.avatar_url).toContain('identityImage')
  })

  it('defaults avatar_url to empty string when no imageUrl', () => {
    const user = mapAzureIdentity(minimalIdentity)
    expect(user.avatar_url).toBe('')
  })

  it('generates a stable numeric id from string id', () => {
    const user1 = mapAzureIdentity(validIdentity)
    const user2 = mapAzureIdentity(validIdentity)
    expect(typeof user1.id).toBe('number')
    expect(user1.id).toBe(user2.id)
    expect(user1.id).toBeGreaterThanOrEqual(0)
  })

  it('generates different ids for different identities', () => {
    const user1 = mapAzureIdentity(validIdentity)
    const user2 = mapAzureIdentity(minimalIdentity)
    expect(user1.id).not.toBe(user2.id)
  })

  it('sets html_url to empty string', () => {
    const user = mapAzureIdentity(validIdentity)
    expect(user.html_url).toBe('')
  })

  it('sets type to User', () => {
    const user = mapAzureIdentity(validIdentity)
    expect(user.type).toBe('User')
  })
})

// ---------------------------------------------------------------------------
// mapAzureReviewerToReview
// ---------------------------------------------------------------------------

describe('mapAzureReviewerToReview', () => {
  it('maps vote 10 to APPROVED', () => {
    const review = mapAzureReviewerToReview(
      { ...validReviewer, vote: 10 },
      prHtmlUrl,
      '2026-01-17T09:00:00Z',
    )
    expect(review.state).toBe('APPROVED')
  })

  it('maps vote 5 to APPROVED', () => {
    const review = mapAzureReviewerToReview(
      { ...validReviewer, vote: 5 },
      prHtmlUrl,
      '2026-01-17T09:00:00Z',
    )
    expect(review.state).toBe('APPROVED')
  })

  it('maps vote -10 to CHANGES_REQUESTED', () => {
    const review = mapAzureReviewerToReview(
      { ...validReviewer, vote: -10 },
      prHtmlUrl,
      '2026-01-17T09:00:00Z',
    )
    expect(review.state).toBe('CHANGES_REQUESTED')
  })

  it('maps vote -5 to CHANGES_REQUESTED', () => {
    const review = mapAzureReviewerToReview(
      { ...validReviewer, vote: -5 },
      prHtmlUrl,
      '2026-01-17T09:00:00Z',
    )
    expect(review.state).toBe('CHANGES_REQUESTED')
  })

  it('maps vote 0 to COMMENTED', () => {
    const review = mapAzureReviewerToReview(
      { ...validReviewer, vote: 0 },
      prHtmlUrl,
      '2026-01-17T09:00:00Z',
    )
    expect(review.state).toBe('COMMENTED')
  })

  it('maps user fields from reviewer', () => {
    const review = mapAzureReviewerToReview(
      validReviewer,
      prHtmlUrl,
      '2026-01-17T09:00:00Z',
    )
    expect(review.user.login).toBe('bob@example.com')
    expect(review.submitted_at).toBe('2026-01-17T09:00:00Z')
    expect(review.html_url).toBe(prHtmlUrl)
    expect(review.body).toBeNull()
  })

  it('generates a stable id from reviewer id', () => {
    const review = mapAzureReviewerToReview(
      validReviewer,
      prHtmlUrl,
      '2026-01-17T09:00:00Z',
    )
    expect(typeof review.id).toBe('number')
    expect(review.id).toBeGreaterThanOrEqual(0)
  })
})

// ---------------------------------------------------------------------------
// mapAzureReviewersToReviews
// ---------------------------------------------------------------------------

describe('mapAzureReviewersToReviews', () => {
  it('filters out reviewers with vote 0', () => {
    const reviewers: readonly AzureReviewer[] = [
      { ...validReviewer, id: 'r1', vote: 10 },
      { ...validReviewer, id: 'r2', vote: 0 },
      { ...validReviewer, id: 'r3', vote: -10 },
    ]
    const reviews = mapAzureReviewersToReviews(
      reviewers,
      prHtmlUrl,
      '2026-01-17T09:00:00Z',
    )
    expect(reviews).toHaveLength(2)
    expect(reviews[0].state).toBe('APPROVED')
    expect(reviews[1].state).toBe('CHANGES_REQUESTED')
  })

  it('returns empty array when all votes are 0', () => {
    const reviewers: readonly AzureReviewer[] = [
      { ...validReviewer, id: 'r1', vote: 0 },
      { ...validReviewer, id: 'r2', vote: 0 },
    ]
    const reviews = mapAzureReviewersToReviews(
      reviewers,
      prHtmlUrl,
      '2026-01-17T09:00:00Z',
    )
    expect(reviews).toEqual([])
  })

  it('returns empty array for empty input', () => {
    const reviews = mapAzureReviewersToReviews(
      [],
      prHtmlUrl,
      '2026-01-17T09:00:00Z',
    )
    expect(reviews).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// mapAzurePRToPullRequest
// ---------------------------------------------------------------------------

describe('mapAzurePRToPullRequest', () => {
  it('maps pullRequestId to number', () => {
    const pr = mapAzurePRToPullRequest(minimalPR, baseUrl, org, project, repoName)
    expect(pr.number).toBe(42)
    expect(pr.id).toBe(42)
  })

  it('maps active status to open', () => {
    const pr = mapAzurePRToPullRequest(minimalPR, baseUrl, org, project, repoName)
    expect(pr.state).toBe('open')
    expect(pr.merged).toBe(false)
  })

  it('maps completed status to closed with merged=true', () => {
    const pr = mapAzurePRToPullRequest(
      { ...minimalPR, status: 'completed', closedDate: '2026-01-17T14:00:00Z' },
      baseUrl, org, project, repoName,
    )
    expect(pr.state).toBe('closed')
    expect(pr.merged).toBe(true)
    expect(pr.merged_at).toBe('2026-01-17T14:00:00Z')
  })

  it('maps abandoned status to closed', () => {
    const pr = mapAzurePRToPullRequest(
      { ...minimalPR, status: 'abandoned', closedDate: '2026-01-17T14:00:00Z' },
      baseUrl, org, project, repoName,
    )
    expect(pr.state).toBe('closed')
    expect(pr.merged).toBe(false)
    expect(pr.closed_at).toBe('2026-01-17T14:00:00Z')
  })

  it('strips refs/heads/ from source branch', () => {
    const pr = mapAzurePRToPullRequest(minimalPR, baseUrl, org, project, repoName)
    expect(pr.head.ref).toBe('feature/dark-mode')
  })

  it('strips refs/heads/ from target branch', () => {
    const pr = mapAzurePRToPullRequest(minimalPR, baseUrl, org, project, repoName)
    expect(pr.base.ref).toBe('main')
  })

  it('builds html_url correctly', () => {
    const pr = mapAzurePRToPullRequest(minimalPR, baseUrl, org, project, repoName)
    expect(pr.html_url).toBe(prHtmlUrl)
  })

  it('maps lastMergeSourceCommit to head.sha', () => {
    const pr = mapAzurePRToPullRequest(
      { ...minimalPR, lastMergeSourceCommit: { commitId: 'src-sha-123' } },
      baseUrl, org, project, repoName,
    )
    expect(pr.head.sha).toBe('src-sha-123')
  })

  it('maps lastMergeTargetCommit to base.sha', () => {
    const pr = mapAzurePRToPullRequest(
      { ...minimalPR, lastMergeTargetCommit: { commitId: 'tgt-sha-456' } },
      baseUrl, org, project, repoName,
    )
    expect(pr.base.sha).toBe('tgt-sha-456')
  })

  it('maps lastMergeCommit to merge_commit_sha', () => {
    const pr = mapAzurePRToPullRequest(
      { ...minimalPR, lastMergeCommit: { commitId: 'merge-sha-789' } },
      baseUrl, org, project, repoName,
    )
    expect(pr.merge_commit_sha).toBe('merge-sha-789')
  })

  it('defaults head.sha and base.sha to empty string', () => {
    const pr = mapAzurePRToPullRequest(minimalPR, baseUrl, org, project, repoName)
    expect(pr.head.sha).toBe('')
    expect(pr.base.sha).toBe('')
  })

  it('maps isDraft', () => {
    const pr = mapAzurePRToPullRequest(
      { ...minimalPR, isDraft: true },
      baseUrl, org, project, repoName,
    )
    expect(pr.draft).toBe(true)
  })

  it('maps labels', () => {
    const pr = mapAzurePRToPullRequest(
      {
        ...minimalPR,
        labels: [
          { id: 'label-1', name: 'bug', active: true },
          { id: 'label-2', name: 'enhancement', active: true },
        ],
      },
      baseUrl, org, project, repoName,
    )
    expect(pr.labels).toHaveLength(2)
    expect(pr.labels[0].name).toBe('bug')
    expect(pr.labels[1].name).toBe('enhancement')
  })

  it('maps reviewers with vote 0 to requested_reviewers', () => {
    const pr = mapAzurePRToPullRequest(
      {
        ...minimalPR,
        reviewers: [
          { ...validReviewer, vote: 0 },
          { ...validReviewer, id: 'r2', displayName: 'Alice', vote: 10 },
        ],
      },
      baseUrl, org, project, repoName,
    )
    expect(pr.requested_reviewers).toHaveLength(1)
    expect(pr.requested_reviewers[0].login).toBe('bob@example.com')
  })

  it('maps description to body, null for empty', () => {
    const pr = mapAzurePRToPullRequest(minimalPR, baseUrl, org, project, repoName)
    expect(pr.body).toBe('Implements dark mode toggle')

    const pr2 = mapAzurePRToPullRequest(
      { ...minimalPR, description: '' },
      baseUrl, org, project, repoName,
    )
    expect(pr2.body).toBeNull()
  })

  it('maps mergeStatus to mergeable_state', () => {
    const pr = mapAzurePRToPullRequest(
      { ...minimalPR, mergeStatus: 'succeeded' },
      baseUrl, org, project, repoName,
    )
    expect(pr.mergeable_state).toBe('succeeded')
  })

  it('sets assignees to empty array', () => {
    const pr = mapAzurePRToPullRequest(minimalPR, baseUrl, org, project, repoName)
    expect(pr.assignees).toEqual([])
  })

  it('sets mergeable to null', () => {
    const pr = mapAzurePRToPullRequest(minimalPR, baseUrl, org, project, repoName)
    expect(pr.mergeable).toBeNull()
  })

  it('maps timestamps', () => {
    const pr = mapAzurePRToPullRequest(minimalPR, baseUrl, org, project, repoName)
    expect(pr.created_at).toBe('2026-01-15T10:00:00Z')
    expect(pr.updated_at).toBe('2026-01-15T10:00:00Z')
  })

  it('uses closedDate for updated_at when present', () => {
    const pr = mapAzurePRToPullRequest(
      { ...minimalPR, closedDate: '2026-01-17T14:00:00Z' },
      baseUrl, org, project, repoName,
    )
    expect(pr.updated_at).toBe('2026-01-17T14:00:00Z')
  })

  it('sets merged_at and closed_at to null for active PRs', () => {
    const pr = mapAzurePRToPullRequest(minimalPR, baseUrl, org, project, repoName)
    expect(pr.merged_at).toBeNull()
    expect(pr.closed_at).toBeNull()
  })

  it('maps createdBy to user', () => {
    const pr = mapAzurePRToPullRequest(minimalPR, baseUrl, org, project, repoName)
    expect(pr.user.login).toBe('jane@example.com')
  })
})

// ---------------------------------------------------------------------------
// mapAzureCommentToComment
// ---------------------------------------------------------------------------

describe('mapAzureCommentToComment', () => {
  it('maps an inline comment with path and line', () => {
    const comment = mapAzureCommentToComment(textComment, inlineThread, prHtmlUrl)
    expect(comment.id).toBe(1)
    expect(comment.body).toBe('This looks great!')
    expect(comment.user.login).toBe('jane@example.com')
    expect(comment.path).toBe('/src/utils.ts')
    expect(comment.line).toBe(15)
    expect(comment.side).toBe('RIGHT')
  })

  it('maps a comment on the left side to LEFT', () => {
    const comment = mapAzureCommentToComment(textComment, leftSideThread, prHtmlUrl)
    expect(comment.line).toBe(10)
    expect(comment.side).toBe('LEFT')
  })

  it('maps a general comment without threadContext', () => {
    const comment = mapAzureCommentToComment(textComment, generalThread, prHtmlUrl)
    expect(comment.path).toBeUndefined()
    expect(comment.line).toBeUndefined()
    expect(comment.side).toBeUndefined()
  })

  it('constructs html_url with discussionId', () => {
    const comment = mapAzureCommentToComment(textComment, inlineThread, prHtmlUrl)
    expect(comment.html_url).toBe(
      `${prHtmlUrl}?_a=files&discussionId=100`,
    )
  })

  it('maps parentCommentId to in_reply_to_id', () => {
    const comment = mapAzureCommentToComment(replyComment, generalThread, prHtmlUrl)
    expect(comment.in_reply_to_id).toBe(1)
  })

  it('sets in_reply_to_id to undefined when parentCommentId is 0', () => {
    const comment = mapAzureCommentToComment(textComment, generalThread, prHtmlUrl)
    expect(comment.in_reply_to_id).toBeUndefined()
  })

  it('sets node_id as threadId:commentId', () => {
    const comment = mapAzureCommentToComment(textComment, inlineThread, prHtmlUrl)
    expect(comment.node_id).toBe('100:1')
  })

  it('maps timestamps', () => {
    const comment = mapAzureCommentToComment(textComment, generalThread, prHtmlUrl)
    expect(comment.created_at).toBe('2026-01-15T10:00:00Z')
    expect(comment.updated_at).toBe('2026-01-15T10:00:00Z')
  })
})

// ---------------------------------------------------------------------------
// mapAzureThreadsToComments
// ---------------------------------------------------------------------------

describe('mapAzureThreadsToComments', () => {
  it('returns only inline thread comments', () => {
    const comments = mapAzureThreadsToComments(
      [inlineThread, generalThread],
      prHtmlUrl,
    )
    expect(comments).toHaveLength(1)
    expect(comments[0].path).toBe('/src/utils.ts')
  })

  it('filters out deleted threads', () => {
    const deletedInline: AzureThread = { ...inlineThread, id: 500, isDeleted: true }
    const comments = mapAzureThreadsToComments(
      [inlineThread, deletedInline],
      prHtmlUrl,
    )
    expect(comments).toHaveLength(1)
  })

  it('filters out system threads', () => {
    const systemInline: AzureThread = {
      ...inlineThread,
      id: 600,
      comments: [systemComment],
    }
    const comments = mapAzureThreadsToComments(
      [inlineThread, systemInline],
      prHtmlUrl,
    )
    expect(comments).toHaveLength(1)
  })

  it('filters out system comments within a mixed thread', () => {
    const mixedThread: AzureThread = {
      ...inlineThread,
      id: 700,
      comments: [textComment, systemComment],
    }
    const comments = mapAzureThreadsToComments(
      [mixedThread],
      prHtmlUrl,
    )
    expect(comments).toHaveLength(1)
    expect(comments[0].body).toBe('This looks great!')
  })

  it('returns empty array for no inline threads', () => {
    const comments = mapAzureThreadsToComments(
      [generalThread, systemThread],
      prHtmlUrl,
    )
    expect(comments).toEqual([])
  })

  it('returns empty array for empty input', () => {
    const comments = mapAzureThreadsToComments([], prHtmlUrl)
    expect(comments).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// mapAzureThreadsToIssueComments
// ---------------------------------------------------------------------------

describe('mapAzureThreadsToIssueComments', () => {
  it('returns only general thread comments', () => {
    const ics = mapAzureThreadsToIssueComments(
      [inlineThread, generalThread],
      prHtmlUrl,
    )
    expect(ics).toHaveLength(2)
    expect(ics[0].body).toBe('This looks great!')
    expect(ics[1].body).toBe('Thanks for the feedback!')
  })

  it('filters out deleted threads', () => {
    const ics = mapAzureThreadsToIssueComments(
      [generalThread, deletedThread],
      prHtmlUrl,
    )
    expect(ics).toHaveLength(2)
  })

  it('filters out system threads', () => {
    const ics = mapAzureThreadsToIssueComments(
      [generalThread, systemThread],
      prHtmlUrl,
    )
    expect(ics).toHaveLength(2)
  })

  it('filters out inline threads', () => {
    const ics = mapAzureThreadsToIssueComments(
      [inlineThread],
      prHtmlUrl,
    )
    expect(ics).toEqual([])
  })

  it('constructs html_url with overview discussionId', () => {
    const ics = mapAzureThreadsToIssueComments(
      [generalThread],
      prHtmlUrl,
    )
    expect(ics[0].html_url).toBe(
      `${prHtmlUrl}?_a=overview&discussionId=200`,
    )
  })

  it('returns empty array for empty input', () => {
    const ics = mapAzureThreadsToIssueComments([], prHtmlUrl)
    expect(ics).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// mapAzureChangeToFileChange
// ---------------------------------------------------------------------------

describe('mapAzureChangeToFileChange', () => {
  it('maps add changeType to added', () => {
    const fc = mapAzureChangeToFileChange({
      changeType: 'add',
      item: { path: '/src/new.ts' },
    })
    expect(fc.status).toBe('added')
    expect(fc.filename).toBe('src/new.ts')
  })

  it('maps edit changeType to modified', () => {
    const fc = mapAzureChangeToFileChange({
      changeType: 'edit',
      item: { path: '/src/utils.ts' },
    })
    expect(fc.status).toBe('modified')
    expect(fc.filename).toBe('src/utils.ts')
  })

  it('maps delete changeType to removed', () => {
    const fc = mapAzureChangeToFileChange({
      changeType: 'delete',
      item: { path: '/src/old.ts' },
    })
    expect(fc.status).toBe('removed')
  })

  it('maps rename changeType to renamed', () => {
    const fc = mapAzureChangeToFileChange({
      changeType: 'rename',
      item: { path: '/src/new-name.ts' },
      originalPath: '/src/old-name.ts',
    })
    expect(fc.status).toBe('renamed')
    expect(fc.filename).toBe('src/new-name.ts')
    expect(fc.previous_filename).toBe('src/old-name.ts')
  })

  it('maps "edit, rename" to renamed', () => {
    const fc = mapAzureChangeToFileChange({
      changeType: 'edit, rename',
      item: { path: '/src/new.ts' },
      originalPath: '/src/old.ts',
    })
    expect(fc.status).toBe('renamed')
  })

  it('maps numeric changeType "1" to added', () => {
    const fc = mapAzureChangeToFileChange({
      changeType: '1',
      item: { path: '/src/file.ts' },
    })
    expect(fc.status).toBe('added')
  })

  it('maps numeric changeType "2" to modified', () => {
    const fc = mapAzureChangeToFileChange({
      changeType: '2',
      item: { path: '/src/file.ts' },
    })
    expect(fc.status).toBe('modified')
  })

  it('maps numeric changeType "8" to renamed', () => {
    const fc = mapAzureChangeToFileChange({
      changeType: '8',
      item: { path: '/src/file.ts' },
    })
    expect(fc.status).toBe('renamed')
  })

  it('maps numeric changeType "10" to renamed', () => {
    const fc = mapAzureChangeToFileChange({
      changeType: '10',
      item: { path: '/src/file.ts' },
    })
    expect(fc.status).toBe('renamed')
  })

  it('maps numeric changeType "16" to removed', () => {
    const fc = mapAzureChangeToFileChange({
      changeType: '16',
      item: { path: '/src/file.ts' },
    })
    expect(fc.status).toBe('removed')
  })

  it('defaults unknown changeType to modified', () => {
    const fc = mapAzureChangeToFileChange({
      changeType: 'unknown_type',
      item: { path: '/src/file.ts' },
    })
    expect(fc.status).toBe('modified')
  })

  it('strips leading slash from path', () => {
    const fc = mapAzureChangeToFileChange({
      changeType: 'edit',
      item: { path: '/src/utils.ts' },
    })
    expect(fc.filename).toBe('src/utils.ts')
  })

  it('strips leading slash from originalPath for renames', () => {
    const fc = mapAzureChangeToFileChange({
      changeType: 'rename',
      item: { path: '/src/new.ts' },
      originalPath: '/src/old.ts',
    })
    expect(fc.previous_filename).toBe('src/old.ts')
  })

  it('does not set previous_filename for non-renamed files', () => {
    const fc = mapAzureChangeToFileChange({
      changeType: 'edit',
      item: { path: '/src/file.ts' },
    })
    expect(fc.previous_filename).toBeUndefined()
  })

  it('handles missing item gracefully', () => {
    const fc = mapAzureChangeToFileChange({
      changeType: 'add',
    } as AzureIterationChange)
    expect(fc.filename).toBe('')
  })

  it('sets sha to empty string', () => {
    const fc = mapAzureChangeToFileChange({
      changeType: 'edit',
      item: { path: '/src/file.ts' },
    })
    expect(fc.sha).toBe('')
  })

  it('sets additions, deletions, changes to 0', () => {
    const fc = mapAzureChangeToFileChange({
      changeType: 'edit',
      item: { path: '/src/file.ts' },
    })
    expect(fc.additions).toBe(0)
    expect(fc.deletions).toBe(0)
    expect(fc.changes).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// mapAzureCommitToCommit
// ---------------------------------------------------------------------------

describe('mapAzureCommitToCommit', () => {
  const azCommit: AzureCommit = {
    commitId: 'abc123def456',
    comment: 'feat: add dark mode\n\nFull description here.',
    author: {
      name: 'Jane Doe',
      email: 'jane@example.com',
      date: '2026-01-15T10:00:00Z',
    },
  }

  it('maps commitId to sha', () => {
    const commit = mapAzureCommitToCommit(azCommit)
    expect(commit.sha).toBe('abc123def456')
  })

  it('maps comment to commit.message', () => {
    const commit = mapAzureCommitToCommit(azCommit)
    expect(commit.commit.message).toBe(
      'feat: add dark mode\n\nFull description here.',
    )
  })

  it('maps author fields', () => {
    const commit = mapAzureCommitToCommit(azCommit)
    expect(commit.commit.author.name).toBe('Jane Doe')
    expect(commit.commit.author.email).toBe('jane@example.com')
    expect(commit.commit.author.date).toBe('2026-01-15T10:00:00Z')
  })

  it('uses remoteUrl from commit when present', () => {
    const commit = mapAzureCommitToCommit({
      ...azCommit,
      remoteUrl: 'https://dev.azure.com/org/proj/_git/repo/commit/abc123',
    })
    expect(commit.html_url).toBe(
      'https://dev.azure.com/org/proj/_git/repo/commit/abc123',
    )
  })

  it('uses fallback remoteUrl parameter', () => {
    const commit = mapAzureCommitToCommit(
      azCommit,
      'https://dev.azure.com/org/proj/_git/repo',
    )
    expect(commit.html_url).toBe(
      'https://dev.azure.com/org/proj/_git/repo',
    )
  })

  it('defaults html_url to empty string when no URL', () => {
    const commit = mapAzureCommitToCommit(azCommit)
    expect(commit.html_url).toBe('')
  })

  it('sets author to null', () => {
    const commit = mapAzureCommitToCommit(azCommit)
    expect(commit.author).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// mapAzureBuildToCheckRun
// ---------------------------------------------------------------------------

describe('mapAzureBuildToCheckRun', () => {
  const completedBuild: AzureBuild = {
    id: 100,
    status: 'completed',
    result: 'succeeded',
    definition: { id: 1, name: 'CI Build' },
    _links: {
      web: { href: 'https://dev.azure.com/org/proj/_build/results?buildId=100' },
    },
    url: 'https://dev.azure.com/org/proj/_apis/build/Builds/100',
  }

  it('maps a completed succeeded build', () => {
    const cr = mapAzureBuildToCheckRun(completedBuild)
    expect(cr.status).toBe('completed')
    expect(cr.conclusion).toBe('success')
    expect(cr.name).toBe('CI Build')
    expect(cr.id).toBe(100)
  })

  it('maps a completed failed build', () => {
    const cr = mapAzureBuildToCheckRun({
      ...completedBuild,
      result: 'failed',
    })
    expect(cr.status).toBe('completed')
    expect(cr.conclusion).toBe('failure')
  })

  it('maps a completed partiallySucceeded build to neutral', () => {
    const cr = mapAzureBuildToCheckRun({
      ...completedBuild,
      result: 'partiallySucceeded',
    })
    expect(cr.conclusion).toBe('neutral')
  })

  it('maps a completed canceled build to cancelled', () => {
    const cr = mapAzureBuildToCheckRun({
      ...completedBuild,
      result: 'canceled',
    })
    expect(cr.conclusion).toBe('cancelled')
  })

  it('maps a completed none result to null conclusion', () => {
    const cr = mapAzureBuildToCheckRun({
      ...completedBuild,
      result: 'none',
    })
    expect(cr.conclusion).toBeNull()
  })

  it('maps inProgress to in_progress with null conclusion', () => {
    const cr = mapAzureBuildToCheckRun({
      ...completedBuild,
      status: 'inProgress',
      result: null,
    })
    expect(cr.status).toBe('in_progress')
    expect(cr.conclusion).toBeNull()
  })

  it('maps notStarted to queued', () => {
    const cr = mapAzureBuildToCheckRun({
      ...completedBuild,
      status: 'notStarted',
      result: null,
    })
    expect(cr.status).toBe('queued')
  })

  it('maps postponed to queued', () => {
    const cr = mapAzureBuildToCheckRun({
      ...completedBuild,
      status: 'postponed',
      result: null,
    })
    expect(cr.status).toBe('queued')
  })

  it('maps cancelling to queued', () => {
    const cr = mapAzureBuildToCheckRun({
      ...completedBuild,
      status: 'cancelling',
      result: null,
    })
    expect(cr.status).toBe('queued')
  })

  it('uses definition name when available', () => {
    const cr = mapAzureBuildToCheckRun(completedBuild)
    expect(cr.name).toBe('CI Build')
  })

  it('falls back to buildNumber when no definition', () => {
    const cr = mapAzureBuildToCheckRun({
      ...completedBuild,
      definition: undefined,
      buildNumber: '20260115.1',
    })
    expect(cr.name).toBe('20260115.1')
  })

  it('falls back to string id when no definition or buildNumber', () => {
    const cr = mapAzureBuildToCheckRun({
      ...completedBuild,
      definition: undefined,
      buildNumber: undefined,
    })
    expect(cr.name).toBe('100')
  })

  it('maps _links.web.href to html_url', () => {
    const cr = mapAzureBuildToCheckRun(completedBuild)
    expect(cr.html_url).toBe(
      'https://dev.azure.com/org/proj/_build/results?buildId=100',
    )
  })

  it('sets html_url to null when no _links', () => {
    const cr = mapAzureBuildToCheckRun({
      ...completedBuild,
      _links: undefined,
    })
    expect(cr.html_url).toBeNull()
  })

  it('maps url to details_url', () => {
    const cr = mapAzureBuildToCheckRun(completedBuild)
    expect(cr.details_url).toBe(
      'https://dev.azure.com/org/proj/_apis/build/Builds/100',
    )
  })

  it('sets details_url to null when no url', () => {
    const cr = mapAzureBuildToCheckRun({
      ...completedBuild,
      url: undefined,
    })
    expect(cr.details_url).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// mapAzureBuildsToCheckRunsResponse
// ---------------------------------------------------------------------------

describe('mapAzureBuildsToCheckRunsResponse', () => {
  it('wraps builds in a CheckRunsResponse', () => {
    const builds: readonly AzureBuild[] = [
      { id: 1, status: 'completed', result: 'succeeded' },
      { id: 2, status: 'completed', result: 'failed' },
    ]
    const response = mapAzureBuildsToCheckRunsResponse(builds)
    expect(response.total_count).toBe(2)
    expect(response.check_runs).toHaveLength(2)
    expect(response.check_runs[0].conclusion).toBe('success')
    expect(response.check_runs[1].conclusion).toBe('failure')
  })

  it('returns empty response for no builds', () => {
    const response = mapAzureBuildsToCheckRunsResponse([])
    expect(response.total_count).toBe(0)
    expect(response.check_runs).toEqual([])
  })
})
