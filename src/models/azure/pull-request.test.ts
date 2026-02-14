import { describe, it, expect } from 'vitest'
import {
  AzureIdentitySchema,
  AzureReviewerSchema,
  AzurePullRequestSchema,
} from './pull-request'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validIdentity = {
  id: 'abc-123-def',
  displayName: 'Jane Doe',
  uniqueName: 'jane@example.com',
  imageUrl: 'https://dev.azure.com/_api/_common/identityImage?id=abc-123-def',
  url: 'https://dev.azure.com/org/_apis/Identities/abc-123-def',
}

const validReviewer = {
  id: 'reviewer-1',
  displayName: 'Bob Smith',
  uniqueName: 'bob@example.com',
  vote: 10,
  isRequired: true,
  hasDeclined: false,
  isFlagged: false,
}

const minimalPR = {
  pullRequestId: 42,
  title: 'Add dark mode',
  description: 'Implements dark mode toggle',
  status: 'active' as const,
  createdBy: validIdentity,
  creationDate: '2026-01-15T10:00:00Z',
  sourceRefName: 'refs/heads/feature/dark-mode',
  targetRefName: 'refs/heads/main',
}

// ---------------------------------------------------------------------------
// AzureIdentitySchema
// ---------------------------------------------------------------------------

describe('AzureIdentitySchema', () => {
  it('parses a fully-populated identity', () => {
    const result = AzureIdentitySchema.parse(validIdentity)
    expect(result.id).toBe('abc-123-def')
    expect(result.displayName).toBe('Jane Doe')
    expect(result.uniqueName).toBe('jane@example.com')
    expect(result.imageUrl).toContain('identityImage')
  })

  it('parses a minimal identity (only required fields)', () => {
    const result = AzureIdentitySchema.parse({
      id: 'id-1',
      displayName: 'John',
    })
    expect(result.id).toBe('id-1')
    expect(result.displayName).toBe('John')
    expect(result.uniqueName).toBeUndefined()
    expect(result.imageUrl).toBeUndefined()
  })

  it('rejects missing id', () => {
    const { id: _, ...noId } = validIdentity
    expect(() => AzureIdentitySchema.parse(noId)).toThrow()
  })

  it('rejects missing displayName', () => {
    const { displayName: _, ...noName } = validIdentity
    expect(() => AzureIdentitySchema.parse(noName)).toThrow()
  })

  it('rejects non-string id', () => {
    expect(() =>
      AzureIdentitySchema.parse({ ...validIdentity, id: 123 }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// AzureReviewerSchema
// ---------------------------------------------------------------------------

describe('AzureReviewerSchema', () => {
  it('parses a fully-populated reviewer', () => {
    const result = AzureReviewerSchema.parse(validReviewer)
    expect(result.id).toBe('reviewer-1')
    expect(result.displayName).toBe('Bob Smith')
    expect(result.vote).toBe(10)
    expect(result.isRequired).toBe(true)
  })

  it('defaults vote to 0', () => {
    const { vote: _, ...noVote } = validReviewer
    const result = AzureReviewerSchema.parse(noVote)
    expect(result.vote).toBe(0)
  })

  it('parses all valid vote values', () => {
    const votes = [-10, -5, 0, 5, 10]
    for (const vote of votes) {
      const result = AzureReviewerSchema.parse({ ...validReviewer, vote })
      expect(result.vote).toBe(vote)
    }
  })

  it('parses a minimal reviewer', () => {
    const result = AzureReviewerSchema.parse({
      id: 'r-1',
      displayName: 'Alice',
    })
    expect(result.id).toBe('r-1')
    expect(result.vote).toBe(0)
    expect(result.isRequired).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// AzurePullRequestSchema
// ---------------------------------------------------------------------------

describe('AzurePullRequestSchema', () => {
  it('parses a minimal pull request', () => {
    const result = AzurePullRequestSchema.parse(minimalPR)
    expect(result.pullRequestId).toBe(42)
    expect(result.title).toBe('Add dark mode')
    expect(result.description).toBe('Implements dark mode toggle')
    expect(result.status).toBe('active')
    expect(result.sourceRefName).toBe('refs/heads/feature/dark-mode')
    expect(result.targetRefName).toBe('refs/heads/main')
  })

  it('defaults optional fields', () => {
    const result = AzurePullRequestSchema.parse(minimalPR)
    expect(result.reviewers).toEqual([])
    expect(result.labels).toEqual([])
    expect(result.isDraft).toBe(false)
  })

  it('parses a fully-populated pull request', () => {
    const fullPR = {
      ...minimalPR,
      status: 'completed' as const,
      closedDate: '2026-01-17T14:00:00Z',
      isDraft: false,
      mergeStatus: 'succeeded',
      reviewers: [validReviewer],
      labels: [{ id: 'label-1', name: 'bug', active: true }],
      lastMergeSourceCommit: { commitId: 'src-sha-123' },
      lastMergeTargetCommit: { commitId: 'tgt-sha-456' },
      lastMergeCommit: { commitId: 'merge-sha-789' },
      repository: {
        id: 'repo-id',
        name: 'my-repo',
        project: { id: 'proj-id', name: 'my-project' },
      },
    }

    const result = AzurePullRequestSchema.parse(fullPR)
    expect(result.status).toBe('completed')
    expect(result.closedDate).toBe('2026-01-17T14:00:00Z')
    expect(result.reviewers).toHaveLength(1)
    expect(result.labels).toHaveLength(1)
    expect(result.lastMergeSourceCommit?.commitId).toBe('src-sha-123')
    expect(result.lastMergeCommit?.commitId).toBe('merge-sha-789')
    expect(result.repository?.name).toBe('my-repo')
  })

  it('defaults null description to empty string', () => {
    const result = AzurePullRequestSchema.parse({
      ...minimalPR,
      description: null,
    })
    expect(result.description).toBe('')
  })

  it('accepts null closedDate', () => {
    const result = AzurePullRequestSchema.parse({
      ...minimalPR,
      closedDate: null,
    })
    expect(result.closedDate).toBeNull()
  })

  it('parses all valid statuses', () => {
    const statuses = ['active', 'abandoned', 'completed', 'all', 'notSet'] as const
    for (const status of statuses) {
      const result = AzurePullRequestSchema.parse({ ...minimalPR, status })
      expect(result.status).toBe(status)
    }
  })

  it('rejects invalid status', () => {
    expect(() =>
      AzurePullRequestSchema.parse({ ...minimalPR, status: 'open' }),
    ).toThrow()
  })

  it('rejects missing title', () => {
    const { title: _, ...noTitle } = minimalPR
    expect(() => AzurePullRequestSchema.parse(noTitle)).toThrow()
  })

  it('rejects missing createdBy', () => {
    const { createdBy: _, ...noCreator } = minimalPR
    expect(() => AzurePullRequestSchema.parse(noCreator)).toThrow()
  })

  it('rejects missing sourceRefName', () => {
    const { sourceRefName: _, ...noSource } = minimalPR
    expect(() => AzurePullRequestSchema.parse(noSource)).toThrow()
  })
})
