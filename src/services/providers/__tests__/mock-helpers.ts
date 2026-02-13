import { Effect } from 'effect'
import { PullRequest, BranchRef, Label } from '../../../models/pull-request'
import { Review } from '../../../models/review'
import { Comment } from '../../../models/comment'
import { IssueComment } from '../../../models/issue-comment'
import { FileChange } from '../../../models/file-change'
import { Commit, CommitDetails, CommitAuthor } from '../../../models/commit'
import { CheckRun, CheckRunsResponse } from '../../../models/check'
import { User } from '../../../models/user'
import type { Provider, ProviderCapabilities, PRListResult } from '../types'
import type { ReviewThread, ApiError } from '../../CodeReviewApiTypes'

// ---------------------------------------------------------------------------
// Model factories
// ---------------------------------------------------------------------------

export function createMockUser(overrides?: Partial<User>): User {
  return new User({
    login: 'testuser',
    id: 1,
    avatar_url: 'https://example.com/avatar.png',
    html_url: 'https://github.com/testuser',
    type: 'User',
    ...overrides,
  })
}

export function createMockPR(overrides?: Partial<PullRequest>): PullRequest {
  return new PullRequest({
    id: 1,
    node_id: 'PR_1',
    number: 1,
    title: 'Test PR',
    body: 'Test body',
    state: 'open',
    draft: false,
    merged: false,
    user: createMockUser(),
    labels: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    merged_at: null,
    closed_at: null,
    html_url: 'https://github.com/owner/repo/pull/1',
    head: new BranchRef({ ref: 'feature', sha: 'abc123' }),
    base: new BranchRef({ ref: 'main', sha: 'def456' }),
    additions: 10,
    deletions: 5,
    changed_files: 3,
    comments: 0,
    review_comments: 0,
    requested_reviewers: [],
    assignees: [],
    mergeable: null,
    mergeable_state: null,
    merge_commit_sha: null,
    ...overrides,
  })
}

export function createMockReview(overrides?: Partial<Review>): Review {
  return new Review({
    id: 1,
    user: createMockUser(),
    body: 'Looks good!',
    state: 'APPROVED',
    submitted_at: '2026-01-01T00:00:00Z',
    html_url: 'https://github.com/owner/repo/pull/1#pullrequestreview-1',
    ...overrides,
  })
}

export function createMockComment(overrides?: Partial<Comment>): Comment {
  return new Comment({
    id: 1,
    node_id: 'C_1',
    body: 'Test comment',
    user: createMockUser(),
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    html_url: 'https://github.com/owner/repo/pull/1#discussion_r1',
    path: 'src/index.ts',
    line: 10,
    side: 'RIGHT',
    ...overrides,
  })
}

export function createMockIssueComment(
  overrides?: Partial<IssueComment>,
): IssueComment {
  return new IssueComment({
    id: 1,
    node_id: 'IC_1',
    body: 'Test issue comment',
    user: createMockUser(),
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    html_url: 'https://github.com/owner/repo/issues/1#issuecomment-1',
    ...overrides,
  })
}

export function createMockFileChange(
  overrides?: Partial<FileChange>,
): FileChange {
  return new FileChange({
    sha: 'abc123',
    filename: 'src/index.ts',
    status: 'modified',
    additions: 5,
    deletions: 2,
    changes: 7,
    patch: '@@ -1,5 +1,8 @@\n+added line',
    ...overrides,
  })
}

export function createMockCommit(overrides?: Partial<Commit>): Commit {
  return new Commit({
    sha: 'abc123',
    commit: new CommitDetails({
      message: 'feat: test commit',
      author: new CommitAuthor({
        name: 'Test User',
        email: 'test@example.com',
        date: '2026-01-01T00:00:00Z',
      }),
    }),
    author: createMockUser(),
    html_url: 'https://github.com/owner/repo/commit/abc123',
    ...overrides,
  })
}

export function createMockCheckRun(overrides?: Partial<CheckRun>): CheckRun {
  return new CheckRun({
    id: 1,
    name: 'CI',
    status: 'completed',
    conclusion: 'success',
    html_url: 'https://github.com/owner/repo/runs/1',
    details_url: null,
    ...overrides,
  })
}

export function createMockCheckRunsResponse(
  overrides?: Partial<CheckRunsResponse>,
): CheckRunsResponse {
  return new CheckRunsResponse({
    total_count: 1,
    check_runs: [createMockCheckRun()],
    ...overrides,
  })
}

export function createMockReviewThread(
  overrides?: Partial<ReviewThread>,
): ReviewThread {
  return {
    id: 'RT_1',
    isResolved: false,
    comments: [{ databaseId: 1 }],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Mock provider factory
// ---------------------------------------------------------------------------

/**
 * Creates a fully functional mock Provider for testing.
 * All methods return canned data by default but can be overridden.
 */
export function createMockProvider(
  type: Provider['type'] = 'github',
  capabilities?: Partial<ProviderCapabilities>,
  methodOverrides?: Partial<Provider>,
): Provider {
  const defaultCapabilities: ProviderCapabilities = {
    supportsDraftPR: true,
    supportsReviewThreads: true,
    supportsGraphQL: true,
    supportsReactions: true,
    supportsCheckRuns: true,
    supportsMergeStrategies: ['merge', 'squash', 'rebase'],
    ...capabilities,
  }

  const mockPR = createMockPR()
  const mockReview = createMockReview()
  const mockComment = createMockComment()
  const mockIssueComment = createMockIssueComment()
  const mockFileChange = createMockFileChange()
  const mockCommit = createMockCommit()
  const mockCheckRunsResponse = createMockCheckRunsResponse()
  const mockReviewThread = createMockReviewThread()

  return {
    type,
    capabilities: defaultCapabilities,

    // PR read operations
    listPRs: () =>
      Effect.succeed({ items: [mockPR] } as PRListResult),
    getPR: () => Effect.succeed(mockPR),
    getPRFiles: () => Effect.succeed([mockFileChange]),
    getPRComments: () => Effect.succeed([mockComment]),
    getIssueComments: () => Effect.succeed([mockIssueComment]),
    getPRReviews: () => Effect.succeed([mockReview]),
    getPRCommits: () => Effect.succeed([mockCommit]),
    getPRChecks: () => Effect.succeed(mockCheckRunsResponse),
    getReviewThreads: () => Effect.succeed([mockReviewThread]),
    getCommitDiff: () => Effect.succeed([mockFileChange]),

    // User-scoped queries
    getMyPRs: () => Effect.succeed([mockPR]),
    getReviewRequests: () => Effect.succeed([mockPR]),
    getInvolvedPRs: () => Effect.succeed([mockPR]),

    // Review mutations
    submitReview: () => Effect.succeed(undefined as void),
    createPendingReview: () => Effect.succeed({ id: 1 }),
    addPendingReviewComment: () => Effect.succeed(undefined as void),
    submitPendingReview: () => Effect.succeed(undefined as void),
    discardPendingReview: () => Effect.succeed(undefined as void),

    // Comment mutations
    addComment: () => Effect.succeed(undefined as void),
    addDiffComment: () => Effect.succeed(undefined as void),
    replyToComment: () => Effect.succeed(undefined as void),
    editIssueComment: () => Effect.succeed(undefined as void),
    editReviewComment: () => Effect.succeed(undefined as void),
    deleteReviewComment: () => Effect.succeed(undefined as void),

    // PR state mutations
    mergePR: () => Effect.succeed(undefined as void),
    closePR: () => Effect.succeed(undefined as void),
    reopenPR: () => Effect.succeed(undefined as void),
    updatePRTitle: () => Effect.succeed(undefined as void),
    updatePRBody: () => Effect.succeed(undefined as void),
    requestReReview: () => Effect.succeed(undefined as void),

    // Thread operations
    resolveThread: () => Effect.succeed(undefined as void),
    unresolveThread: () => Effect.succeed(undefined as void),

    // Draft operations
    convertToDraft: () => Effect.succeed(undefined as void),
    markReadyForReview: () => Effect.succeed(undefined as void),

    // User info
    getCurrentUser: () => Effect.succeed({ login: 'testuser' }),

    ...methodOverrides,
  }
}

/**
 * Creates a mock GitHub provider with full capabilities.
 */
export function createMockGitHubProvider(
  overrides?: Partial<Provider>,
): Provider {
  return createMockProvider('github', {
    supportsDraftPR: true,
    supportsReviewThreads: true,
    supportsGraphQL: true,
    supportsReactions: true,
    supportsCheckRuns: true,
    supportsMergeStrategies: ['merge', 'squash', 'rebase'],
  }, overrides)
}

/**
 * Creates a mock GitLab provider with GitLab-appropriate capabilities.
 */
export function createMockGitLabProvider(
  overrides?: Partial<Provider>,
): Provider {
  return createMockProvider('gitlab', {
    supportsDraftPR: true,
    supportsReviewThreads: true,
    supportsGraphQL: true,
    supportsReactions: true,
    supportsCheckRuns: true,
    supportsMergeStrategies: ['merge', 'squash', 'rebase'],
  }, overrides)
}

/**
 * Creates a mock Bitbucket provider with Bitbucket-appropriate capabilities.
 */
export function createMockBitbucketProvider(
  overrides?: Partial<Provider>,
): Provider {
  return createMockProvider('bitbucket', {
    supportsDraftPR: false,
    supportsReviewThreads: false,
    supportsGraphQL: false,
    supportsReactions: false,
    supportsCheckRuns: false,
    supportsMergeStrategies: ['merge', 'squash'],
  }, overrides)
}

/**
 * Creates a mock provider with minimal capabilities for testing
 * providers that don't support optional features.
 */
export function createMinimalMockProvider(
  type: Provider['type'] = 'bitbucket',
  overrides?: Partial<Provider>,
): Provider {
  return createMockProvider(type, {
    supportsDraftPR: false,
    supportsReviewThreads: false,
    supportsGraphQL: false,
    supportsReactions: false,
    supportsCheckRuns: false,
    supportsMergeStrategies: ['merge'],
  }, overrides)
}
