import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect, Exit } from 'effect'
import { createBitbucketProvider } from './bitbucket'
import { createProvider } from './index'
import type { ProviderConfig } from './types'

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch

function mockFetchResponse(options: {
  readonly ok?: boolean
  readonly status?: number
  readonly statusText?: string
  readonly body?: unknown
  readonly headers?: Record<string, string>
} = {}): void {
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

const TEST_CONFIG: ProviderConfig = {
  type: 'bitbucket',
  baseUrl: 'https://api.bitbucket.org/2.0',
  token: 'bb-test-token',
  owner: 'myworkspace',
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

// ---------------------------------------------------------------------------
// Bitbucket test fixtures
// ---------------------------------------------------------------------------

function makeBBUser(overrides?: Record<string, unknown>) {
  return {
    display_name: 'Test User',
    uuid: '{test-uuid}',
    nickname: 'testuser',
    links: { avatar: { href: 'https://avatar.example.com/test.png' } },
    ...overrides,
  }
}

function makeBBPR(overrides?: Record<string, unknown>) {
  return {
    id: 1,
    title: 'Test PR',
    description: 'A test pull request',
    state: 'OPEN',
    author: makeBBUser(),
    source: {
      branch: { name: 'feature' },
      commit: { hash: 'abc123' },
    },
    destination: {
      branch: { name: 'main' },
      commit: { hash: 'def456' },
    },
    reviewers: [],
    participants: [],
    created_on: '2026-01-01T00:00:00.000000+00:00',
    updated_on: '2026-01-02T00:00:00.000000+00:00',
    links: { html: { href: 'https://bitbucket.org/ws/repo/pull-requests/1' } },
    comment_count: 0,
    task_count: 0,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// createBitbucketProvider
// ---------------------------------------------------------------------------

describe('createBitbucketProvider', () => {
  it('returns a provider with type bitbucket', () => {
    const provider = createBitbucketProvider(TEST_CONFIG)
    expect(provider.type).toBe('bitbucket')
  })

  it('exposes correct capabilities', () => {
    const provider = createBitbucketProvider(TEST_CONFIG)
    expect(provider.capabilities.supportsDraftPR).toBe(false)
    expect(provider.capabilities.supportsReviewThreads).toBe(false)
    expect(provider.capabilities.supportsGraphQL).toBe(false)
    expect(provider.capabilities.supportsReactions).toBe(false)
    expect(provider.capabilities.supportsCheckRuns).toBe(true)
    expect(provider.capabilities.supportsMergeStrategies).toEqual([
      'merge',
      'squash',
      'rebase',
    ])
  })

  // -----------------------------------------------------------------------
  // Read operations
  // -----------------------------------------------------------------------

  describe('read operations', () => {
    it('listPRs returns items when API responds', async () => {
      const bbPR = makeBBPR()
      mockFetchResponse({ body: { values: [bbPR] } })
      const provider = createBitbucketProvider(TEST_CONFIG)
      const result = await Effect.runPromise(provider.listPRs({}))
      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.number).toBe(1)
      expect(result.items[0]!.title).toBe('Test PR')
    })

    it('getPR returns a PullRequest when API responds', async () => {
      const bbPR = makeBBPR()
      mockFetchResponse({ body: bbPR })
      const provider = createBitbucketProvider(TEST_CONFIG)
      const result = await Effect.runPromise(provider.getPR(1))
      expect(result.number).toBe(1)
      expect(result.title).toBe('Test PR')
      expect(result.state).toBe('open')
    })

    it('getPR maps MERGED state correctly', async () => {
      const bbPR = makeBBPR({
        state: 'MERGED',
        merge_commit: { hash: 'merge123' },
      })
      mockFetchResponse({ body: bbPR })
      const provider = createBitbucketProvider(TEST_CONFIG)
      const result = await Effect.runPromise(provider.getPR(1))
      expect(result.state).toBe('closed')
      expect(result.merged).toBe(true)
      expect(result.merge_commit_sha).toBe('merge123')
    })

    it('getPR maps DECLINED state correctly', async () => {
      const bbPR = makeBBPR({ state: 'DECLINED' })
      mockFetchResponse({ body: bbPR })
      const provider = createBitbucketProvider(TEST_CONFIG)
      const result = await Effect.runPromise(provider.getPR(1))
      expect(result.state).toBe('closed')
      expect(result.merged).toBe(false)
    })

    it('getPRFiles returns file changes from diffstat', async () => {
      const diffstat = [
        {
          status: 'modified',
          old: { path: 'src/index.ts' },
          new: { path: 'src/index.ts' },
          lines_added: 10,
          lines_removed: 3,
        },
      ]
      mockFetchResponse({ body: { values: diffstat } })
      const provider = createBitbucketProvider(TEST_CONFIG)
      const result = await Effect.runPromise(provider.getPRFiles(1))
      expect(result).toHaveLength(1)
      expect(result[0]!.filename).toBe('src/index.ts')
      expect(result[0]!.status).toBe('modified')
      expect(result[0]!.additions).toBe(10)
      expect(result[0]!.deletions).toBe(3)
    })

    it('getPRReviews maps participants to reviews', async () => {
      const bbPR = makeBBPR({
        participants: [
          {
            user: makeBBUser({ nickname: 'reviewer1' }),
            role: 'REVIEWER',
            approved: true,
            state: 'approved',
          },
          {
            user: makeBBUser({ nickname: 'reviewer2' }),
            role: 'REVIEWER',
            approved: false,
            state: null,
          },
          {
            user: makeBBUser({ nickname: 'author' }),
            role: 'AUTHOR',
            approved: false,
            state: null,
          },
        ],
      })
      mockFetchResponse({ body: bbPR })
      const provider = createBitbucketProvider(TEST_CONFIG)
      const result = await Effect.runPromise(provider.getPRReviews(1))
      // Only REVIEWER participants are included
      expect(result).toHaveLength(2)
      expect(result[0]!.state).toBe('APPROVED')
      expect(result[1]!.state).toBe('COMMENTED')
    })

    it('getPRCommits returns commits', async () => {
      const commits = [
        {
          hash: 'abc123',
          message: 'feat: add feature',
          date: '2026-01-01T00:00:00+00:00',
          author: { raw: 'Test User <test@example.com>' },
          links: { html: { href: 'https://bitbucket.org/ws/repo/commits/abc123' } },
        },
      ]
      mockFetchResponse({ body: { values: commits } })
      const provider = createBitbucketProvider(TEST_CONFIG)
      const result = await Effect.runPromise(provider.getPRCommits(1))
      expect(result).toHaveLength(1)
      expect(result[0]!.sha).toBe('abc123')
      expect(result[0]!.commit.message).toBe('feat: add feature')
      expect(result[0]!.commit.author.name).toBe('Test User')
      expect(result[0]!.commit.author.email).toBe('test@example.com')
    })

    it('getReviewThreads returns empty array', async () => {
      const provider = createBitbucketProvider(TEST_CONFIG)
      const result = await Effect.runPromise(provider.getReviewThreads(1))
      expect(result).toEqual([])
    })

    it('getCurrentUser returns login from username', async () => {
      mockFetchResponse({
        body: { username: 'alice', uuid: '{alice-uuid}', display_name: 'Alice' },
      })
      const provider = createBitbucketProvider(TEST_CONFIG)
      const result = await Effect.runPromise(provider.getCurrentUser())
      expect(result.login).toBe('alice')
    })
  })

  // -----------------------------------------------------------------------
  // Review mutations
  // -----------------------------------------------------------------------

  describe('submitReview', () => {
    it('approves PR for APPROVE event', async () => {
      mockFetchResponse()
      const provider = createBitbucketProvider(TEST_CONFIG)
      await Effect.runPromise(provider.submitReview(42, '', 'APPROVE'))

      const url = getLastFetchUrl()
      expect(url).toContain('/approve')
    })

    it('approves PR and adds comment for APPROVE with body', async () => {
      mockFetchResponse()
      const provider = createBitbucketProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.submitReview(42, 'Looks great!', 'APPROVE'),
      )

      // Should have made two calls: approve + comment
      const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
      expect(calls.length).toBe(2)
      expect((calls[0][0] as string)).toContain('/approve')
      expect((calls[1][0] as string)).toContain('/comments')
    })

    it('adds comment for REQUEST_CHANGES event', async () => {
      mockFetchResponse()
      const provider = createBitbucketProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.submitReview(42, 'Please fix this', 'REQUEST_CHANGES'),
      )

      const url = getLastFetchUrl()
      expect(url).toContain('/comments')
      const body = getLastFetchBody()
      expect(body.content).toEqual({ raw: 'Please fix this' })
    })

    it('uses default message for REQUEST_CHANGES with empty body', async () => {
      mockFetchResponse()
      const provider = createBitbucketProvider(TEST_CONFIG)
      await Effect.runPromise(provider.submitReview(42, '', 'REQUEST_CHANGES'))

      const body = getLastFetchBody()
      expect(body.content).toEqual({ raw: 'Changes requested.' })
    })

    it('adds comment for COMMENT event', async () => {
      mockFetchResponse()
      const provider = createBitbucketProvider(TEST_CONFIG)
      await Effect.runPromise(provider.submitReview(42, 'Nice work', 'COMMENT'))

      const url = getLastFetchUrl()
      expect(url).toContain('/comments')
    })
  })

  describe('createPendingReview', () => {
    it('returns dummy id=0 since Bitbucket has no pending reviews', async () => {
      const provider = createBitbucketProvider(TEST_CONFIG)
      const result = await Effect.runPromise(provider.createPendingReview(42))
      expect(result.id).toBe(0)
    })
  })

  describe('discardPendingReview', () => {
    it('succeeds as no-op since Bitbucket has no pending reviews', async () => {
      const provider = createBitbucketProvider(TEST_CONFIG)
      const result = await Effect.runPromise(
        provider.discardPendingReview(42, 0),
      )
      expect(result).toBeUndefined()
    })
  })

  // -----------------------------------------------------------------------
  // Comment mutations
  // -----------------------------------------------------------------------

  describe('addComment', () => {
    it('posts comment to PR', async () => {
      mockFetchResponse()
      const provider = createBitbucketProvider(TEST_CONFIG)
      await Effect.runPromise(provider.addComment(42, 'Hello!'))

      const url = getLastFetchUrl()
      expect(url).toContain(
        `/repositories/${TEST_CONFIG.owner}/${TEST_CONFIG.repo}/pullrequests/42/comments`,
      )
      const body = getLastFetchBody()
      expect(body.content).toEqual({ raw: 'Hello!' })
    })
  })

  describe('addDiffComment', () => {
    it('posts inline comment with inline.to for RIGHT side', async () => {
      mockFetchResponse()
      const provider = createBitbucketProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.addDiffComment({
          prNumber: 42,
          body: 'Fix this',
          commitId: 'abc123',
          path: 'src/foo.ts',
          line: 10,
          side: 'RIGHT',
        }),
      )

      const body = getLastFetchBody()
      expect(body.content).toEqual({ raw: 'Fix this' })
      expect(body.inline).toEqual({ path: 'src/foo.ts', to: 10 })
    })

    it('posts inline comment with inline.from for LEFT side', async () => {
      mockFetchResponse()
      const provider = createBitbucketProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.addDiffComment({
          prNumber: 42,
          body: 'Old line comment',
          commitId: 'abc123',
          path: 'src/foo.ts',
          line: 5,
          side: 'LEFT',
        }),
      )

      const body = getLastFetchBody()
      expect(body.inline).toEqual({ path: 'src/foo.ts', from: 5 })
    })
  })

  describe('replyToComment', () => {
    it('posts reply with parent.id', async () => {
      mockFetchResponse()
      const provider = createBitbucketProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.replyToComment(42, 99, 'Thanks!'),
      )

      const body = getLastFetchBody()
      expect(body.parent).toEqual({ id: 99 })
    })
  })

  // -----------------------------------------------------------------------
  // PR state mutations
  // -----------------------------------------------------------------------

  describe('mergePR', () => {
    it('sends merge request with merge_commit strategy', async () => {
      mockFetchResponse()
      const provider = createBitbucketProvider(TEST_CONFIG)
      await Effect.runPromise(provider.mergePR(42, 'merge'))

      const url = getLastFetchUrl()
      expect(url).toContain('/merge')
      const body = getLastFetchBody()
      expect(body.merge_strategy).toBe('merge_commit')
    })

    it('sends squash merge request', async () => {
      mockFetchResponse()
      const provider = createBitbucketProvider(TEST_CONFIG)
      await Effect.runPromise(provider.mergePR(42, 'squash', 'Title'))

      const body = getLastFetchBody()
      expect(body.merge_strategy).toBe('squash')
      expect(body.message).toBe('Title')
    })
  })

  describe('closePR', () => {
    it('sends decline request', async () => {
      mockFetchResponse()
      const provider = createBitbucketProvider(TEST_CONFIG)
      await Effect.runPromise(provider.closePR(42))

      const url = getLastFetchUrl()
      expect(url).toContain('/decline')
    })
  })

  describe('reopenPR', () => {
    it('fails with descriptive error since Bitbucket does not support reopen', async () => {
      const provider = createBitbucketProvider(TEST_CONFIG)
      const exit = await Effect.runPromiseExit(provider.reopenPR(42))
      expect(Exit.isFailure(exit)).toBe(true)
    })
  })

  describe('updatePRTitle', () => {
    it('updates title', async () => {
      mockFetchResponse()
      const provider = createBitbucketProvider(TEST_CONFIG)
      await Effect.runPromise(provider.updatePRTitle(42, 'New Title'))

      const body = getLastFetchBody()
      expect(body.title).toBe('New Title')
    })
  })

  describe('updatePRBody', () => {
    it('updates description', async () => {
      mockFetchResponse()
      const provider = createBitbucketProvider(TEST_CONFIG)
      await Effect.runPromise(provider.updatePRBody(42, 'New description'))

      const body = getLastFetchBody()
      expect(body.description).toBe('New description')
    })
  })

  describe('requestReReview', () => {
    it('updates reviewers with uuid objects', async () => {
      mockFetchResponse()
      const provider = createBitbucketProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.requestReReview(42, ['{uuid-1}', '{uuid-2}']),
      )

      const body = getLastFetchBody()
      expect(body.reviewers).toEqual([
        { uuid: '{uuid-1}' },
        { uuid: '{uuid-2}' },
      ])
    })

    it('fails when no reviewers provided', async () => {
      const provider = createBitbucketProvider(TEST_CONFIG)
      const exit = await Effect.runPromiseExit(
        provider.requestReReview(42, []),
      )
      expect(Exit.isFailure(exit)).toBe(true)
    })
  })

  // -----------------------------------------------------------------------
  // Unsupported operations
  // -----------------------------------------------------------------------

  describe('unsupported operations', () => {
    it('resolveThread fails with descriptive error', async () => {
      const provider = createBitbucketProvider(TEST_CONFIG)
      const exit = await Effect.runPromiseExit(
        provider.resolveThread('thread-1'),
      )
      expect(Exit.isFailure(exit)).toBe(true)
    })

    it('unresolveThread fails with descriptive error', async () => {
      const provider = createBitbucketProvider(TEST_CONFIG)
      const exit = await Effect.runPromiseExit(
        provider.unresolveThread('thread-1'),
      )
      expect(Exit.isFailure(exit)).toBe(true)
    })

    it('convertToDraft fails with descriptive error', async () => {
      const provider = createBitbucketProvider(TEST_CONFIG)
      const exit = await Effect.runPromiseExit(
        provider.convertToDraft('node-id'),
      )
      expect(Exit.isFailure(exit)).toBe(true)
    })

    it('markReadyForReview fails with descriptive error', async () => {
      const provider = createBitbucketProvider(TEST_CONFIG)
      const exit = await Effect.runPromiseExit(
        provider.markReadyForReview('node-id'),
      )
      expect(Exit.isFailure(exit)).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// createProvider factory integration
// ---------------------------------------------------------------------------

describe('createProvider with bitbucket type', () => {
  it('creates a Bitbucket provider for type bitbucket', () => {
    const mockService = {} as never
    const provider = createProvider(TEST_CONFIG, mockService)
    expect(provider.type).toBe('bitbucket')
    expect(provider.capabilities.supportsCheckRuns).toBe(true)
  })

  it('Bitbucket provider has merge, squash and rebase strategies', () => {
    const mockService = {} as never
    const provider = createProvider(TEST_CONFIG, mockService)
    expect(provider.capabilities.supportsMergeStrategies).toEqual([
      'merge',
      'squash',
      'rebase',
    ])
  })

  it('Bitbucket provider does not support drafts or threads', () => {
    const mockService = {} as never
    const provider = createProvider(TEST_CONFIG, mockService)
    expect(provider.capabilities.supportsDraftPR).toBe(false)
    expect(provider.capabilities.supportsReviewThreads).toBe(false)
  })
})
