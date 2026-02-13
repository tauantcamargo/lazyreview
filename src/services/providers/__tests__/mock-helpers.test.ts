import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import {
  createMockUser,
  createMockPR,
  createMockReview,
  createMockComment,
  createMockIssueComment,
  createMockFileChange,
  createMockCommit,
  createMockCheckRun,
  createMockCheckRunsResponse,
  createMockReviewThread,
  createMockProvider,
  createMockGitHubProvider,
  createMockGitLabProvider,
  createMockBitbucketProvider,
  createMinimalMockProvider,
} from './mock-helpers'
import { createUnsupportedProvider } from '../github'

// ---------------------------------------------------------------------------
// Model factory tests
// ---------------------------------------------------------------------------

describe('createMockUser', () => {
  it('creates a user with defaults', () => {
    const user = createMockUser()
    expect(user.login).toBe('testuser')
    expect(user.id).toBe(1)
    expect(user.avatar_url).toBe('https://example.com/avatar.png')
  })

  it('allows overrides', () => {
    const user = createMockUser({ login: 'custom', id: 42 })
    expect(user.login).toBe('custom')
    expect(user.id).toBe(42)
  })
})

describe('createMockPR', () => {
  it('creates a PR with defaults', () => {
    const pr = createMockPR()
    expect(pr.number).toBe(1)
    expect(pr.title).toBe('Test PR')
    expect(pr.state).toBe('open')
    expect(pr.draft).toBe(false)
    expect(pr.user.login).toBe('testuser')
  })

  it('allows overrides', () => {
    const pr = createMockPR({ number: 42, title: 'Custom PR', state: 'closed' })
    expect(pr.number).toBe(42)
    expect(pr.title).toBe('Custom PR')
    expect(pr.state).toBe('closed')
  })
})

describe('createMockReview', () => {
  it('creates a review with defaults', () => {
    const review = createMockReview()
    expect(review.id).toBe(1)
    expect(review.state).toBe('APPROVED')
    expect(review.body).toBe('Looks good!')
  })

  it('allows overrides', () => {
    const review = createMockReview({ state: 'CHANGES_REQUESTED', body: 'Fix this' })
    expect(review.state).toBe('CHANGES_REQUESTED')
    expect(review.body).toBe('Fix this')
  })
})

describe('createMockComment', () => {
  it('creates a comment with defaults', () => {
    const comment = createMockComment()
    expect(comment.id).toBe(1)
    expect(comment.body).toBe('Test comment')
    expect(comment.path).toBe('src/index.ts')
    expect(comment.line).toBe(10)
  })

  it('allows overrides', () => {
    const comment = createMockComment({ body: 'Custom', line: 20 })
    expect(comment.body).toBe('Custom')
    expect(comment.line).toBe(20)
  })
})

describe('createMockIssueComment', () => {
  it('creates an issue comment with defaults', () => {
    const comment = createMockIssueComment()
    expect(comment.id).toBe(1)
    expect(comment.body).toBe('Test issue comment')
  })

  it('allows overrides', () => {
    const comment = createMockIssueComment({ body: 'Override' })
    expect(comment.body).toBe('Override')
  })
})

describe('createMockFileChange', () => {
  it('creates a file change with defaults', () => {
    const file = createMockFileChange()
    expect(file.filename).toBe('src/index.ts')
    expect(file.status).toBe('modified')
    expect(file.additions).toBe(5)
  })

  it('allows overrides', () => {
    const file = createMockFileChange({ filename: 'README.md', status: 'added' })
    expect(file.filename).toBe('README.md')
    expect(file.status).toBe('added')
  })
})

describe('createMockCommit', () => {
  it('creates a commit with defaults', () => {
    const commit = createMockCommit()
    expect(commit.sha).toBe('abc123')
    expect(commit.commit.message).toBe('feat: test commit')
  })

  it('allows overrides', () => {
    const commit = createMockCommit({ sha: 'xyz789' })
    expect(commit.sha).toBe('xyz789')
  })
})

describe('createMockCheckRun', () => {
  it('creates a check run with defaults', () => {
    const check = createMockCheckRun()
    expect(check.id).toBe(1)
    expect(check.name).toBe('CI')
    expect(check.status).toBe('completed')
    expect(check.conclusion).toBe('success')
  })

  it('allows overrides', () => {
    const check = createMockCheckRun({ name: 'Lint', conclusion: 'failure' })
    expect(check.name).toBe('Lint')
    expect(check.conclusion).toBe('failure')
  })
})

describe('createMockCheckRunsResponse', () => {
  it('creates a response with defaults', () => {
    const response = createMockCheckRunsResponse()
    expect(response.total_count).toBe(1)
    expect(response.check_runs).toHaveLength(1)
  })
})

describe('createMockReviewThread', () => {
  it('creates a thread with defaults', () => {
    const thread = createMockReviewThread()
    expect(thread.id).toBe('RT_1')
    expect(thread.isResolved).toBe(false)
    expect(thread.comments).toHaveLength(1)
  })

  it('allows overrides', () => {
    const thread = createMockReviewThread({ isResolved: true })
    expect(thread.isResolved).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Provider factory tests
// ---------------------------------------------------------------------------

describe('createMockProvider', () => {
  it('creates a provider with specified type', () => {
    const provider = createMockProvider('azure')
    expect(provider.type).toBe('azure')
  })

  it('creates a provider with custom capabilities', () => {
    const provider = createMockProvider('gitea', {
      supportsDraftPR: false,
      supportsGraphQL: false,
    })
    expect(provider.capabilities.supportsDraftPR).toBe(false)
    expect(provider.capabilities.supportsGraphQL).toBe(false)
    // Defaults still apply for non-overridden capabilities
    expect(provider.capabilities.supportsReviewThreads).toBe(true)
  })

  it('allows method overrides', () => {
    const provider = createMockProvider('github', undefined, {
      getCurrentUser: () => Effect.succeed({ login: 'overridden' }),
    })
    return Effect.runPromise(provider.getCurrentUser()).then((user) => {
      expect(user.login).toBe('overridden')
    })
  })
})

describe('createMockGitHubProvider', () => {
  it('creates a GitHub provider with full capabilities', () => {
    const provider = createMockGitHubProvider()
    expect(provider.type).toBe('github')
    expect(provider.capabilities.supportsDraftPR).toBe(true)
    expect(provider.capabilities.supportsReviewThreads).toBe(true)
    expect(provider.capabilities.supportsGraphQL).toBe(true)
    expect(provider.capabilities.supportsReactions).toBe(true)
    expect(provider.capabilities.supportsCheckRuns).toBe(true)
    expect(provider.capabilities.supportsMergeStrategies).toEqual([
      'merge',
      'squash',
      'rebase',
    ])
  })
})

describe('createMockGitLabProvider', () => {
  it('creates a GitLab provider with appropriate capabilities', () => {
    const provider = createMockGitLabProvider()
    expect(provider.type).toBe('gitlab')
    expect(provider.capabilities.supportsCheckRuns).toBe(true)
    expect(provider.capabilities.supportsMergeStrategies).toEqual([
      'merge',
      'squash',
      'rebase',
    ])
  })
})

describe('createMockBitbucketProvider', () => {
  it('creates a Bitbucket provider with limited capabilities', () => {
    const provider = createMockBitbucketProvider()
    expect(provider.type).toBe('bitbucket')
    expect(provider.capabilities.supportsDraftPR).toBe(false)
    expect(provider.capabilities.supportsReviewThreads).toBe(false)
    expect(provider.capabilities.supportsGraphQL).toBe(false)
    expect(provider.capabilities.supportsReactions).toBe(false)
  })
})

describe('createMinimalMockProvider', () => {
  it('creates a provider with minimal capabilities', () => {
    const provider = createMinimalMockProvider()
    expect(provider.capabilities.supportsDraftPR).toBe(false)
    expect(provider.capabilities.supportsReviewThreads).toBe(false)
    expect(provider.capabilities.supportsGraphQL).toBe(false)
    expect(provider.capabilities.supportsReactions).toBe(false)
    expect(provider.capabilities.supportsCheckRuns).toBe(false)
    expect(provider.capabilities.supportsMergeStrategies).toEqual(['merge'])
  })

  it('accepts custom type', () => {
    const provider = createMinimalMockProvider('azure')
    expect(provider.type).toBe('azure')
  })
})

// ---------------------------------------------------------------------------
// Unsupported provider tests
// ---------------------------------------------------------------------------

describe('createUnsupportedProvider', () => {
  it('creates a provider that fails all operations', async () => {
    const provider = createUnsupportedProvider('gitea')
    expect(provider.type).toBe('gitea')

    const result = await Effect.runPromiseExit(provider.listPRs({}))
    expect(result._tag).toBe('Failure')
  })

  it('has no capabilities', () => {
    const provider = createUnsupportedProvider('azure')
    expect(provider.capabilities.supportsDraftPR).toBe(false)
    expect(provider.capabilities.supportsReviewThreads).toBe(false)
    expect(provider.capabilities.supportsGraphQL).toBe(false)
    expect(provider.capabilities.supportsReactions).toBe(false)
    expect(provider.capabilities.supportsCheckRuns).toBe(false)
    expect(provider.capabilities.supportsMergeStrategies).toEqual([])
  })

  it('fails getPR with provider not supported message', async () => {
    const provider = createUnsupportedProvider('gitea')
    const result = await Effect.runPromiseExit(provider.getPR(1))
    expect(result._tag).toBe('Failure')
  })

  it('fails submitReview', async () => {
    const provider = createUnsupportedProvider('gitea')
    const result = await Effect.runPromiseExit(
      provider.submitReview(1, 'test', 'APPROVE'),
    )
    expect(result._tag).toBe('Failure')
  })

  it('fails mergePR', async () => {
    const provider = createUnsupportedProvider('gitea')
    const result = await Effect.runPromiseExit(provider.mergePR(1, 'merge'))
    expect(result._tag).toBe('Failure')
  })

  it('fails getCurrentUser', async () => {
    const provider = createUnsupportedProvider('gitea')
    const result = await Effect.runPromiseExit(provider.getCurrentUser())
    expect(result._tag).toBe('Failure')
  })
})
