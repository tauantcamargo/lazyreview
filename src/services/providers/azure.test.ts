import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect, Exit } from 'effect'
import {
  createAzureProvider,
  encodeAzureThreadId,
  decodeAzureThreadId,
} from './azure'
import { createProvider } from './index'
import type { ProviderConfig } from './types'

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch

interface MockFetchOptions {
  readonly ok?: boolean
  readonly status?: number
  readonly statusText?: string
  readonly body?: unknown
  readonly headers?: Record<string, string>
}

function mockFetchResponse(options: MockFetchOptions = {}): void {
  const {
    ok = true,
    status = 200,
    statusText = 'OK',
    body = {},
    headers = {},
  } = options
  const mockHeaders = new Headers(headers)

  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    statusText,
    headers: mockHeaders,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  })
}

/**
 * Mock fetch to return different responses on consecutive calls.
 */
function mockFetchSequence(
  responses: readonly MockFetchOptions[],
): void {
  let callIndex = 0
  globalThis.fetch = vi.fn().mockImplementation(async () => {
    const options = responses[callIndex] ?? responses[responses.length - 1]
    callIndex++
    const {
      ok = true,
      status = 200,
      statusText = 'OK',
      body = {},
      headers = {},
    } = options!
    const mockHeaders = new Headers(headers)

    return {
      ok,
      status,
      statusText,
      headers: mockHeaders,
      json: vi.fn().mockResolvedValue(body),
      text: vi.fn().mockResolvedValue(JSON.stringify(body)),
    }
  })
}

const TEST_CONFIG: ProviderConfig = {
  type: 'azure',
  baseUrl: 'https://dev.azure.com',
  token: 'az-test-pat-token',
  owner: 'myorg/myproject',
  repo: 'myrepo',
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

function getLastFetchUrl(): string {
  const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
  return calls[calls.length - 1][0] as string
}

function getLastFetchBody(): Record<string, unknown> {
  const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
  const lastCall = calls[calls.length - 1]
  const options = lastCall[1] as { body: string }
  return JSON.parse(options.body) as Record<string, unknown>
}

function getLastFetchMethod(): string {
  const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
  const lastCall = calls[calls.length - 1]
  const options = lastCall[1] as { method?: string }
  return options.method ?? 'GET'
}

function getNthFetchUrl(n: number): string {
  const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
  return calls[n][0] as string
}

// ---------------------------------------------------------------------------
// Azure DevOps test fixtures
// ---------------------------------------------------------------------------

function makeAzureIdentity(overrides?: Record<string, unknown>) {
  return {
    id: 'user-id-123',
    displayName: 'Test User',
    uniqueName: 'testuser@example.com',
    imageUrl: 'https://dev.azure.com/_api/_common/identityImage?id=user-id-123',
    ...overrides,
  }
}

function makeAzureReviewer(overrides?: Record<string, unknown>) {
  return {
    id: 'reviewer-id-1',
    displayName: 'Reviewer One',
    uniqueName: 'reviewer1@example.com',
    vote: 0,
    ...overrides,
  }
}

function makeAzurePR(overrides?: Record<string, unknown>) {
  return {
    pullRequestId: 42,
    title: 'Add feature X',
    description: 'Implements feature X',
    status: 'active',
    createdBy: makeAzureIdentity(),
    creationDate: '2026-01-15T10:00:00Z',
    closedDate: null,
    sourceRefName: 'refs/heads/feature/x',
    targetRefName: 'refs/heads/main',
    isDraft: false,
    reviewers: [],
    labels: [],
    ...overrides,
  }
}

function makeAzureThread(overrides?: Record<string, unknown>) {
  return {
    id: 100,
    publishedDate: '2026-01-15T10:00:00Z',
    lastUpdatedDate: '2026-01-15T10:00:00Z',
    comments: [
      {
        id: 1,
        content: 'This is a comment',
        publishedDate: '2026-01-15T10:00:00Z',
        lastUpdatedDate: '2026-01-15T10:00:00Z',
        commentType: 'text',
        parentCommentId: 0,
        author: makeAzureIdentity(),
      },
    ],
    status: 'active',
    isDeleted: false,
    threadContext: {
      filePath: '/src/index.ts',
      rightFileStart: { line: 10, offset: 1 },
      rightFileEnd: { line: 10, offset: 1 },
    },
    ...overrides,
  }
}

function makeAzureIteration(overrides?: Record<string, unknown>) {
  return {
    id: 1,
    description: 'Iteration 1',
    createdDate: '2026-01-15T10:00:00Z',
    ...overrides,
  }
}

function makeAzureIterationChange(overrides?: Record<string, unknown>) {
  return {
    changeId: 1,
    changeType: 'edit',
    item: { path: '/src/index.ts' },
    ...overrides,
  }
}

function makeAzureCommit(overrides?: Record<string, unknown>) {
  return {
    commitId: 'abc123def456',
    comment: 'feat: add feature',
    author: {
      name: 'Test User',
      email: 'test@example.com',
      date: '2026-01-15T10:00:00Z',
    },
    ...overrides,
  }
}

function makeAzureBuild(overrides?: Record<string, unknown>) {
  return {
    id: 100,
    status: 'completed',
    result: 'succeeded',
    definition: { id: 1, name: 'CI Build' },
    _links: {
      web: {
        href: 'https://dev.azure.com/myorg/myproject/_build/results?buildId=100',
      },
    },
    url: 'https://dev.azure.com/myorg/myproject/_apis/build/Builds/100',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// encodeAzureThreadId / decodeAzureThreadId
// ---------------------------------------------------------------------------

describe('encodeAzureThreadId', () => {
  it('encodes prId and threadId as colon-separated string', () => {
    expect(encodeAzureThreadId(42, 100)).toBe('42:100')
  })

  it('encodes zero values', () => {
    expect(encodeAzureThreadId(0, 0)).toBe('0:0')
  })
})

describe('decodeAzureThreadId', () => {
  it('decodes colon-separated string', () => {
    const result = decodeAzureThreadId('42:100')
    expect(result.prId).toBe(42)
    expect(result.threadId).toBe(100)
  })

  it('returns threadId from plain number string when no separator', () => {
    const result = decodeAzureThreadId('100')
    expect(result.prId).toBe(0)
    expect(result.threadId).toBe(100)
  })

  it('returns zeros for non-numeric input without separator', () => {
    const result = decodeAzureThreadId('abc')
    expect(result.prId).toBe(0)
    expect(result.threadId).toBe(0)
  })

  it('returns zeros for non-numeric parts with separator', () => {
    const result = decodeAzureThreadId('abc:def')
    expect(result.prId).toBe(0)
    expect(result.threadId).toBe(0)
  })

  it('handles empty string', () => {
    const result = decodeAzureThreadId('')
    expect(result.prId).toBe(0)
    expect(result.threadId).toBe(0)
  })

  it('handles string with only separator', () => {
    const result = decodeAzureThreadId(':')
    expect(result.prId).toBe(0)
    expect(result.threadId).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// createAzureProvider
// ---------------------------------------------------------------------------

describe('createAzureProvider', () => {
  it('returns a provider with type azure', () => {
    const provider = createAzureProvider(TEST_CONFIG)
    expect(provider.type).toBe('azure')
  })

  it('exposes correct capabilities', () => {
    const provider = createAzureProvider(TEST_CONFIG)
    expect(provider.capabilities.supportsDraftPR).toBe(true)
    expect(provider.capabilities.supportsReviewThreads).toBe(true)
    expect(provider.capabilities.supportsGraphQL).toBe(false)
    expect(provider.capabilities.supportsReactions).toBe(false)
    expect(provider.capabilities.supportsCheckRuns).toBe(true)
    expect(provider.capabilities.supportsMergeStrategies).toEqual([
      'noFastForward',
      'squash',
      'rebase',
      'rebaseMerge',
    ])
  })

  // -----------------------------------------------------------------------
  // Read operations
  // -----------------------------------------------------------------------

  describe('read operations', () => {
    it('listPRs returns items when API responds', async () => {
      mockFetchResponse({ body: { value: [makeAzurePR()] } })
      const provider = createAzureProvider(TEST_CONFIG)
      const result = await Effect.runPromise(provider.listPRs({}))
      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.number).toBe(42)
      expect(result.items[0]!.title).toBe('Add feature X')
    })

    it('listPRs passes state filter', async () => {
      mockFetchResponse({ body: { value: [] } })
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(provider.listPRs({ state: 'closed' }))

      const url = getLastFetchUrl()
      expect(url).toContain('searchCriteria.status=completed')
    })

    it('listPRs passes all state filter', async () => {
      mockFetchResponse({ body: { value: [] } })
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(provider.listPRs({ state: 'all' }))

      const url = getLastFetchUrl()
      expect(url).toContain('searchCriteria.status=all')
    })

    it('listPRs defaults to active state', async () => {
      mockFetchResponse({ body: { value: [] } })
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(provider.listPRs({}))

      const url = getLastFetchUrl()
      expect(url).toContain('searchCriteria.status=active')
    })

    it('listPRs passes pagination params', async () => {
      mockFetchResponse({ body: { value: [] } })
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.listPRs({ perPage: 20, page: 3 }),
      )

      const url = getLastFetchUrl()
      expect(url).toContain('%24top=20')
      expect(url).toContain('%24skip=40')
    })

    it('getPR returns a PullRequest when API responds', async () => {
      mockFetchResponse({ body: makeAzurePR() })
      const provider = createAzureProvider(TEST_CONFIG)
      const result = await Effect.runPromise(provider.getPR(42))
      expect(result.number).toBe(42)
      expect(result.title).toBe('Add feature X')
      expect(result.state).toBe('open')
    })

    it('getPR maps completed PR', async () => {
      mockFetchResponse({
        body: makeAzurePR({
          status: 'completed',
          closedDate: '2026-01-17T14:00:00Z',
        }),
      })
      const provider = createAzureProvider(TEST_CONFIG)
      const result = await Effect.runPromise(provider.getPR(42))
      expect(result.state).toBe('closed')
      expect(result.merged).toBe(true)
    })

    it('getPRFiles returns file changes', async () => {
      mockFetchSequence([
        {
          body: {
            value: [makeAzureIteration(), makeAzureIteration({ id: 2 })],
          },
        },
        {
          body: {
            changeEntries: [
              makeAzureIterationChange(),
              makeAzureIterationChange({
                changeId: 2,
                changeType: 'add',
                item: { path: '/src/new.ts' },
              }),
            ],
          },
        },
      ])
      const provider = createAzureProvider(TEST_CONFIG)
      const result = await Effect.runPromise(provider.getPRFiles(42))
      expect(result).toHaveLength(2)
      expect(result[0]!.filename).toBe('src/index.ts')
      expect(result[0]!.status).toBe('modified')
      expect(result[1]!.filename).toBe('src/new.ts')
      expect(result[1]!.status).toBe('added')
    })

    it('getPRFiles returns empty array when no iterations', async () => {
      mockFetchResponse({ body: { value: [] } })
      const provider = createAzureProvider(TEST_CONFIG)
      const result = await Effect.runPromise(provider.getPRFiles(42))
      expect(result).toEqual([])
    })

    it('getPRFiles uses latest iteration', async () => {
      mockFetchSequence([
        {
          body: {
            value: [
              makeAzureIteration({ id: 1 }),
              makeAzureIteration({ id: 3 }),
            ],
          },
        },
        {
          body: {
            changeEntries: [makeAzureIterationChange()],
          },
        },
      ])
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(provider.getPRFiles(42))

      // Second call should reference iteration 3 (the latest)
      const secondUrl = getNthFetchUrl(1)
      expect(secondUrl).toContain('/iterations/3/changes')
    })

    it('getPRComments returns inline comments', async () => {
      mockFetchResponse({
        body: { value: [makeAzureThread()] },
      })
      const provider = createAzureProvider(TEST_CONFIG)
      const result = await Effect.runPromise(provider.getPRComments(42))
      expect(result).toHaveLength(1)
      expect(result[0]!.body).toBe('This is a comment')
      expect(result[0]!.path).toBe('/src/index.ts')
    })

    it('getIssueComments returns general comments', async () => {
      const generalThread = makeAzureThread({
        id: 200,
        threadContext: null,
      })
      mockFetchResponse({
        body: { value: [generalThread] },
      })
      const provider = createAzureProvider(TEST_CONFIG)
      const result = await Effect.runPromise(
        provider.getIssueComments(42),
      )
      expect(result).toHaveLength(1)
      expect(result[0]!.body).toBe('This is a comment')
    })

    it('getPRReviews returns reviews from reviewers', async () => {
      mockFetchResponse({
        body: makeAzurePR({
          reviewers: [
            makeAzureReviewer({ id: 'r1', vote: 10 }),
            makeAzureReviewer({ id: 'r2', vote: -5 }),
            makeAzureReviewer({ id: 'r3', vote: 0 }),
          ],
        }),
      })
      const provider = createAzureProvider(TEST_CONFIG)
      const result = await Effect.runPromise(provider.getPRReviews(42))
      // vote 0 is filtered out
      expect(result).toHaveLength(2)
      expect(result[0]!.state).toBe('APPROVED')
      expect(result[1]!.state).toBe('CHANGES_REQUESTED')
    })

    it('getPRCommits returns commits', async () => {
      mockFetchResponse({
        body: { value: [makeAzureCommit()] },
      })
      const provider = createAzureProvider(TEST_CONFIG)
      const result = await Effect.runPromise(provider.getPRCommits(42))
      expect(result).toHaveLength(1)
      expect(result[0]!.sha).toBe('abc123def456')
      expect(result[0]!.commit.message).toBe('feat: add feature')
    })

    it('getPRChecks returns check runs from builds', async () => {
      mockFetchResponse({
        body: { value: [makeAzureBuild()] },
      })
      const provider = createAzureProvider(TEST_CONFIG)
      const result = await Effect.runPromise(
        provider.getPRChecks('feature/x'),
      )
      expect(result.total_count).toBe(1)
      expect(result.check_runs).toHaveLength(1)
      expect(result.check_runs[0]!.name).toBe('CI Build')
      expect(result.check_runs[0]!.conclusion).toBe('success')
    })

    it('getPRChecks returns empty response when no builds', async () => {
      mockFetchResponse({ body: { value: [] } })
      const provider = createAzureProvider(TEST_CONFIG)
      const result = await Effect.runPromise(
        provider.getPRChecks('feature/x'),
      )
      expect(result.total_count).toBe(0)
      expect(result.check_runs).toEqual([])
    })

    it('getPRChecks prepends refs/heads/ when missing', async () => {
      mockFetchResponse({ body: { value: [] } })
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(provider.getPRChecks('feature/x'))

      const url = getLastFetchUrl()
      expect(url).toContain('branchName=refs%2Fheads%2Ffeature%2Fx')
    })

    it('getPRChecks does not double-prepend refs/heads/', async () => {
      mockFetchResponse({ body: { value: [] } })
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.getPRChecks('refs/heads/feature/x'),
      )

      const url = getLastFetchUrl()
      expect(url).toContain('branchName=refs%2Fheads%2Ffeature%2Fx')
      expect(url).not.toContain('refs%2Fheads%2Frefs%2Fheads')
    })

    it('getReviewThreads returns filtered threads', async () => {
      const inlineThread = makeAzureThread({ id: 100 })
      const systemThread = makeAzureThread({
        id: 200,
        comments: [
          {
            id: 3,
            content: 'System message',
            commentType: 'system',
            parentCommentId: 0,
            author: makeAzureIdentity(),
          },
        ],
      })
      const deletedThread = makeAzureThread({ id: 300, isDeleted: true })
      const noContextThread = makeAzureThread({
        id: 400,
        threadContext: null,
      })

      mockFetchResponse({
        body: {
          value: [
            inlineThread,
            systemThread,
            deletedThread,
            noContextThread,
          ],
        },
      })
      const provider = createAzureProvider(TEST_CONFIG)
      const result = await Effect.runPromise(
        provider.getReviewThreads(42),
      )
      // Only inlineThread should pass: has threadContext, not deleted, has non-system comments
      expect(result).toHaveLength(1)
      expect(result[0]!.id).toBe('42:100')
      expect(result[0]!.isResolved).toBe(false)
    })

    it('getReviewThreads marks resolved statuses correctly', async () => {
      const fixedThread = makeAzureThread({ id: 101, status: 'fixed' })
      const closedThread = makeAzureThread({ id: 102, status: 'closed' })
      const wontFixThread = makeAzureThread({
        id: 103,
        status: 'wontFix',
      })
      const byDesignThread = makeAzureThread({
        id: 104,
        status: 'byDesign',
      })

      mockFetchResponse({
        body: {
          value: [fixedThread, closedThread, wontFixThread, byDesignThread],
        },
      })
      const provider = createAzureProvider(TEST_CONFIG)
      const result = await Effect.runPromise(
        provider.getReviewThreads(42),
      )
      expect(result).toHaveLength(4)
      expect(result.every((t) => t.isResolved)).toBe(true)
    })

    it('getCommitDiff returns file changes', async () => {
      mockFetchResponse({
        body: {
          changes: [
            {
              changeType: 'edit',
              item: { path: '/src/file.ts' },
            },
            {
              changeType: 'add',
              item: { path: '/src/new.ts' },
            },
          ],
        },
      })
      const provider = createAzureProvider(TEST_CONFIG)
      const result = await Effect.runPromise(
        provider.getCommitDiff('abc123'),
      )
      expect(result).toHaveLength(2)
      expect(result[0]!.status).toBe('modified')
      expect(result[1]!.status).toBe('added')
    })

    it('getCommitDiff handles empty changes', async () => {
      mockFetchResponse({ body: { changes: [] } })
      const provider = createAzureProvider(TEST_CONFIG)
      const result = await Effect.runPromise(
        provider.getCommitDiff('abc123'),
      )
      expect(result).toEqual([])
    })

    it('getCommitDiff handles null changes', async () => {
      mockFetchResponse({ body: { changes: null } })
      const provider = createAzureProvider(TEST_CONFIG)
      const result = await Effect.runPromise(
        provider.getCommitDiff('abc123'),
      )
      expect(result).toEqual([])
    })

    it('getCommitDiff maps sourceServerItem to originalPath', async () => {
      mockFetchResponse({
        body: {
          changes: [
            {
              changeType: 'rename',
              item: { path: '/src/new-name.ts' },
              sourceServerItem: '/src/old-name.ts',
            },
          ],
        },
      })
      const provider = createAzureProvider(TEST_CONFIG)
      const result = await Effect.runPromise(
        provider.getCommitDiff('abc123'),
      )
      expect(result[0]!.status).toBe('renamed')
      expect(result[0]!.previous_filename).toBe('src/old-name.ts')
    })
  })

  // -----------------------------------------------------------------------
  // User-scoped queries
  // -----------------------------------------------------------------------

  describe('user-scoped queries', () => {
    it('getMyPRs returns PRs created by current user', async () => {
      mockFetchSequence([
        {
          body: {
            authenticatedUser: {
              id: 'my-user-id',
              providerDisplayName: 'Me',
            },
          },
        },
        {
          body: { value: [makeAzurePR()] },
        },
      ])
      const provider = createAzureProvider(TEST_CONFIG)
      const result = await Effect.runPromise(provider.getMyPRs())
      expect(result).toHaveLength(1)
      expect(result[0]!.number).toBe(42)

      // Second call should include creatorId filter
      const prUrl = getNthFetchUrl(1)
      expect(prUrl).toContain('searchCriteria.creatorId=my-user-id')
    })

    it('getReviewRequests returns PRs assigned for review', async () => {
      mockFetchSequence([
        {
          body: {
            authenticatedUser: {
              id: 'my-user-id',
              providerDisplayName: 'Me',
            },
          },
        },
        {
          body: { value: [makeAzurePR()] },
        },
      ])
      const provider = createAzureProvider(TEST_CONFIG)
      const result = await Effect.runPromise(
        provider.getReviewRequests(),
      )
      expect(result).toHaveLength(1)

      const prUrl = getNthFetchUrl(1)
      expect(prUrl).toContain('searchCriteria.reviewerId=my-user-id')
    })

    it('getMyPRs passes state filter', async () => {
      mockFetchSequence([
        {
          body: {
            authenticatedUser: {
              id: 'my-user-id',
              providerDisplayName: 'Me',
            },
          },
        },
        {
          body: { value: [] },
        },
      ])
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(provider.getMyPRs('closed'))

      const prUrl = getNthFetchUrl(1)
      expect(prUrl).toContain('searchCriteria.status=completed')
    })

    it('getInvolvedPRs returns all PRs', async () => {
      mockFetchResponse({ body: { value: [makeAzurePR()] } })
      const provider = createAzureProvider(TEST_CONFIG)
      const result = await Effect.runPromise(
        provider.getInvolvedPRs(),
      )
      expect(result).toHaveLength(1)
    })

    it('getInvolvedPRs passes state filter', async () => {
      mockFetchResponse({ body: { value: [] } })
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(provider.getInvolvedPRs('all'))

      const url = getLastFetchUrl()
      expect(url).toContain('searchCriteria.status=all')
    })

    it('getCurrentUser returns login from connection data', async () => {
      mockFetchResponse({
        body: {
          authenticatedUser: {
            id: 'my-user-id',
            providerDisplayName: 'My Display Name',
          },
        },
      })
      const provider = createAzureProvider(TEST_CONFIG)
      const result = await Effect.runPromise(provider.getCurrentUser())
      expect(result.login).toBe('My Display Name')
    })

    it('getCurrentUser caches user data across calls', async () => {
      mockFetchResponse({
        body: {
          authenticatedUser: {
            id: 'my-user-id',
            providerDisplayName: 'Cached User',
          },
        },
      })
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(provider.getCurrentUser())
      await Effect.runPromise(provider.getCurrentUser())

      // Should only fetch once due to caching
      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    })
  })

  // -----------------------------------------------------------------------
  // Review mutations
  // -----------------------------------------------------------------------

  describe('submitReview', () => {
    it('votes approve and creates thread for APPROVE with body', async () => {
      mockFetchSequence([
        // getConnectionData
        {
          body: {
            authenticatedUser: {
              id: 'my-id',
              providerDisplayName: 'Me',
            },
          },
        },
        // votePR
        {},
        // createThread
        {},
      ])
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.submitReview(42, 'LGTM', 'APPROVE'),
      )

      expect(globalThis.fetch).toHaveBeenCalledTimes(3)
    })

    it('votes approve without creating thread for APPROVE with empty body', async () => {
      mockFetchSequence([
        {
          body: {
            authenticatedUser: {
              id: 'my-id',
              providerDisplayName: 'Me',
            },
          },
        },
        {},
      ])
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.submitReview(42, '', 'APPROVE'),
      )

      // Only getConnectionData + votePR
      expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    })

    it('votes -5 and creates thread for REQUEST_CHANGES', async () => {
      mockFetchSequence([
        {
          body: {
            authenticatedUser: {
              id: 'my-id',
              providerDisplayName: 'Me',
            },
          },
        },
        {},
        {},
      ])
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.submitReview(42, 'Fix these issues', 'REQUEST_CHANGES'),
      )

      expect(globalThis.fetch).toHaveBeenCalledTimes(3)
    })

    it('uses default message for REQUEST_CHANGES with empty body', async () => {
      mockFetchSequence([
        {
          body: {
            authenticatedUser: {
              id: 'my-id',
              providerDisplayName: 'Me',
            },
          },
        },
        {},
        {},
      ])
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.submitReview(42, '', 'REQUEST_CHANGES'),
      )

      expect(globalThis.fetch).toHaveBeenCalledTimes(3)
    })

    it('creates thread for COMMENT event', async () => {
      mockFetchSequence([
        {
          body: {
            authenticatedUser: {
              id: 'my-id',
              providerDisplayName: 'Me',
            },
          },
        },
        {},
      ])
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.submitReview(42, 'Nice work', 'COMMENT'),
      )

      expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    })

    it('uses default message for COMMENT with empty body', async () => {
      mockFetchSequence([
        {
          body: {
            authenticatedUser: {
              id: 'my-id',
              providerDisplayName: 'Me',
            },
          },
        },
        {},
      ])
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.submitReview(42, '', 'COMMENT'),
      )

      expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('createPendingReview', () => {
    it('returns dummy id 0', async () => {
      const provider = createAzureProvider(TEST_CONFIG)
      const result = await Effect.runPromise(
        provider.createPendingReview(42),
      )
      expect(result.id).toBe(0)
    })
  })

  describe('discardPendingReview', () => {
    it('succeeds as no-op', async () => {
      const provider = createAzureProvider(TEST_CONFIG)
      const result = await Effect.runPromise(
        provider.discardPendingReview(42, 0),
      )
      expect(result).toBeUndefined()
    })
  })

  describe('addPendingReviewComment', () => {
    it('creates thread with inline context for RIGHT side', async () => {
      mockFetchResponse()
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.addPendingReviewComment({
          prNumber: 42,
          reviewId: 0,
          body: 'Fix this',
          path: 'src/index.ts',
          line: 10,
          side: 'RIGHT',
        }),
      )

      const body = getLastFetchBody()
      expect(body.threadContext).toEqual({
        filePath: '/src/index.ts',
        rightFileStart: { line: 10, offset: 1 },
        rightFileEnd: { line: 10, offset: 1 },
      })
    })

    it('creates thread with inline context for LEFT side', async () => {
      mockFetchResponse()
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.addPendingReviewComment({
          prNumber: 42,
          reviewId: 0,
          body: 'Old line issue',
          path: 'src/old.ts',
          line: 5,
          side: 'LEFT',
        }),
      )

      const body = getLastFetchBody()
      expect(body.threadContext).toEqual({
        filePath: '/src/old.ts',
        leftFileStart: { line: 5, offset: 1 },
        leftFileEnd: { line: 5, offset: 1 },
      })
    })
  })

  describe('submitPendingReview', () => {
    it('votes and creates thread for APPROVE with body', async () => {
      mockFetchSequence([
        {
          body: {
            authenticatedUser: {
              id: 'my-id',
              providerDisplayName: 'Me',
            },
          },
        },
        {},
        {},
      ])
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.submitPendingReview(42, 0, 'LGTM', 'APPROVE'),
      )

      expect(globalThis.fetch).toHaveBeenCalledTimes(3)
    })

    it('votes without thread for APPROVE with empty body', async () => {
      mockFetchSequence([
        {
          body: {
            authenticatedUser: {
              id: 'my-id',
              providerDisplayName: 'Me',
            },
          },
        },
        {},
      ])
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.submitPendingReview(42, 0, '', 'APPROVE'),
      )

      expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    })

    it('votes -5 for REQUEST_CHANGES with body', async () => {
      mockFetchSequence([
        {
          body: {
            authenticatedUser: {
              id: 'my-id',
              providerDisplayName: 'Me',
            },
          },
        },
        {},
        {},
      ])
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.submitPendingReview(
          42,
          0,
          'Please fix',
          'REQUEST_CHANGES',
        ),
      )

      expect(globalThis.fetch).toHaveBeenCalledTimes(3)
    })

    it('creates thread for COMMENT with body', async () => {
      mockFetchSequence([
        {
          body: {
            authenticatedUser: {
              id: 'my-id',
              providerDisplayName: 'Me',
            },
          },
        },
        {},
      ])
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.submitPendingReview(42, 0, 'Nice', 'COMMENT'),
      )

      expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    })

    it('does nothing for COMMENT with empty body', async () => {
      mockFetchSequence([
        {
          body: {
            authenticatedUser: {
              id: 'my-id',
              providerDisplayName: 'Me',
            },
          },
        },
      ])
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.submitPendingReview(42, 0, '', 'COMMENT'),
      )

      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    })
  })

  // -----------------------------------------------------------------------
  // Comment mutations
  // -----------------------------------------------------------------------

  describe('addComment', () => {
    it('creates a thread on the PR', async () => {
      mockFetchResponse()
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(provider.addComment(42, 'Hello!'))

      const url = getLastFetchUrl()
      expect(url).toContain('/pullrequests/42/threads')
    })
  })

  describe('addDiffComment', () => {
    it('creates inline thread for RIGHT side', async () => {
      mockFetchResponse()
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.addDiffComment({
          prNumber: 42,
          body: 'Fix this line',
          commitId: 'abc123',
          path: 'src/index.ts',
          line: 15,
          side: 'RIGHT',
        }),
      )

      const body = getLastFetchBody()
      expect(body.threadContext).toEqual({
        filePath: '/src/index.ts',
        rightFileStart: { line: 15, offset: 1 },
        rightFileEnd: { line: 15, offset: 1 },
      })
    })

    it('creates inline thread for LEFT side', async () => {
      mockFetchResponse()
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.addDiffComment({
          prNumber: 42,
          body: 'Old code',
          commitId: 'abc123',
          path: 'src/old.ts',
          line: 5,
          side: 'LEFT',
        }),
      )

      const body = getLastFetchBody()
      expect(body.threadContext).toEqual({
        filePath: '/src/old.ts',
        leftFileStart: { line: 5, offset: 1 },
        leftFileEnd: { line: 5, offset: 1 },
      })
    })
  })

  describe('replyToComment', () => {
    it('replies to a thread', async () => {
      mockFetchResponse()
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.replyToComment(42, 100, 'Thanks!'),
      )

      const url = getLastFetchUrl()
      expect(url).toContain('/threads/100/comments')
    })
  })

  // -----------------------------------------------------------------------
  // PR state mutations
  // -----------------------------------------------------------------------

  describe('mergePR', () => {
    it('sends completed status with merge strategy for merge method', async () => {
      mockFetchResponse()
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(provider.mergePR(42, 'merge'))

      const body = getLastFetchBody()
      expect(body.status).toBe('completed')
      expect((body.completionOptions as Record<string, unknown>).mergeStrategy).toBe(1)
    })

    it('uses squash strategy (3) for squash method', async () => {
      mockFetchResponse()
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(provider.mergePR(42, 'squash'))

      const body = getLastFetchBody()
      expect((body.completionOptions as Record<string, unknown>).mergeStrategy).toBe(3)
    })

    it('uses rebase strategy (2) for rebase method', async () => {
      mockFetchResponse()
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(provider.mergePR(42, 'rebase'))

      const body = getLastFetchBody()
      expect((body.completionOptions as Record<string, unknown>).mergeStrategy).toBe(2)
    })

    it('includes merge commit message from title', async () => {
      mockFetchResponse()
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.mergePR(42, 'merge', 'My Title'),
      )

      const body = getLastFetchBody()
      expect(
        (body.completionOptions as Record<string, unknown>).mergeCommitMessage,
      ).toBe('My Title')
    })

    it('includes merge commit message from title and body', async () => {
      mockFetchResponse()
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.mergePR(42, 'merge', 'My Title', 'My Body'),
      )

      const body = getLastFetchBody()
      expect(
        (body.completionOptions as Record<string, unknown>).mergeCommitMessage,
      ).toBe('My Title\n\nMy Body')
    })

    it('sets deleteSourceBranch to false', async () => {
      mockFetchResponse()
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(provider.mergePR(42, 'squash'))

      const body = getLastFetchBody()
      expect(
        (body.completionOptions as Record<string, unknown>).deleteSourceBranch,
      ).toBe(false)
    })
  })

  describe('closePR', () => {
    it('sends abandoned status', async () => {
      mockFetchResponse()
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(provider.closePR(42))

      const body = getLastFetchBody()
      expect(body.status).toBe('abandoned')
    })
  })

  describe('reopenPR', () => {
    it('sends active status', async () => {
      mockFetchResponse()
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(provider.reopenPR(42))

      const body = getLastFetchBody()
      expect(body.status).toBe('active')
    })
  })

  describe('updatePRTitle', () => {
    it('updates title', async () => {
      mockFetchResponse()
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.updatePRTitle(42, 'New Title'),
      )

      const body = getLastFetchBody()
      expect(body.title).toBe('New Title')
    })
  })

  describe('updatePRBody', () => {
    it('updates description', async () => {
      mockFetchResponse()
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.updatePRBody(42, 'New description'),
      )

      const body = getLastFetchBody()
      expect(body.description).toBe('New description')
    })
  })

  describe('requestReReview', () => {
    it('adds reviewers', async () => {
      mockFetchResponse()
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.requestReReview(42, ['user-1', 'user-2']),
      )

      // Should have called addReviewer for each reviewer
      expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    })

    it('fails when no reviewers provided', async () => {
      const provider = createAzureProvider(TEST_CONFIG)
      const exit = await Effect.runPromiseExit(
        provider.requestReReview(42, []),
      )
      expect(Exit.isFailure(exit)).toBe(true)
    })
  })

  // -----------------------------------------------------------------------
  // Thread operations
  // -----------------------------------------------------------------------

  describe('resolveThread', () => {
    it('updates thread status to fixed (2)', async () => {
      mockFetchResponse()
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(provider.resolveThread('42:100'))

      const body = getLastFetchBody()
      expect(body.status).toBe(2)
    })

    it('decodes encoded thread id correctly', async () => {
      mockFetchResponse()
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(provider.resolveThread('55:200'))

      const url = getLastFetchUrl()
      expect(url).toContain('/pullrequests/55/threads/200')
    })
  })

  describe('unresolveThread', () => {
    it('updates thread status to active (1)', async () => {
      mockFetchResponse()
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(provider.unresolveThread('42:100'))

      const body = getLastFetchBody()
      expect(body.status).toBe(1)
    })
  })

  // -----------------------------------------------------------------------
  // Draft operations
  // -----------------------------------------------------------------------

  describe('convertToDraft', () => {
    it('sets isDraft to true', async () => {
      mockFetchResponse()
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(provider.convertToDraft('42'))

      const body = getLastFetchBody()
      expect(body.isDraft).toBe(true)
    })

    it('fails for non-numeric PR ID', async () => {
      const provider = createAzureProvider(TEST_CONFIG)
      const exit = await Effect.runPromiseExit(
        provider.convertToDraft('not-a-number'),
      )
      expect(Exit.isFailure(exit)).toBe(true)
    })
  })

  describe('markReadyForReview', () => {
    it('sets isDraft to false', async () => {
      mockFetchResponse()
      const provider = createAzureProvider(TEST_CONFIG)
      await Effect.runPromise(provider.markReadyForReview('42'))

      const body = getLastFetchBody()
      expect(body.isDraft).toBe(false)
    })

    it('fails for non-numeric PR ID', async () => {
      const provider = createAzureProvider(TEST_CONFIG)
      const exit = await Effect.runPromiseExit(
        provider.markReadyForReview('abc'),
      )
      expect(Exit.isFailure(exit)).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// createProvider factory integration
// ---------------------------------------------------------------------------

describe('createProvider with azure type', () => {
  it('creates an Azure provider for type azure', () => {
    const mockService = {} as never
    const provider = createProvider(TEST_CONFIG, mockService)
    expect(provider.type).toBe('azure')
    expect(provider.capabilities.supportsCheckRuns).toBe(true)
  })

  it('Azure provider has correct merge strategies', () => {
    const mockService = {} as never
    const provider = createProvider(TEST_CONFIG, mockService)
    expect(provider.capabilities.supportsMergeStrategies).toEqual([
      'noFastForward',
      'squash',
      'rebase',
      'rebaseMerge',
    ])
  })

  it('Azure provider supports drafts and threads', () => {
    const mockService = {} as never
    const provider = createProvider(TEST_CONFIG, mockService)
    expect(provider.capabilities.supportsDraftPR).toBe(true)
    expect(provider.capabilities.supportsReviewThreads).toBe(true)
  })

  it('Azure provider does not support GraphQL or reactions', () => {
    const mockService = {} as never
    const provider = createProvider(TEST_CONFIG, mockService)
    expect(provider.capabilities.supportsGraphQL).toBe(false)
    expect(provider.capabilities.supportsReactions).toBe(false)
  })
})
