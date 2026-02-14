import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect, Exit } from 'effect'
import { createGiteaProvider } from './gitea'
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

function mockFetchSequence(
  responses: ReadonlyArray<{
    readonly ok?: boolean
    readonly status?: number
    readonly statusText?: string
    readonly body?: unknown
    readonly headers?: Record<string, string>
  }>,
): void {
  const mockFn = vi.fn()
  for (const [index, options] of responses.entries()) {
    const {
      ok = true,
      status = 200,
      statusText = 'OK',
      body = {},
      headers = {},
    } = options
    const mockHeaders = new Headers(headers)

    mockFn.mockResolvedValueOnce({
      ok,
      status,
      statusText,
      headers: mockHeaders,
      json: vi.fn().mockResolvedValue(body),
      text: vi.fn().mockResolvedValue(JSON.stringify(body)),
    })
  }
  globalThis.fetch = mockFn
}

const TEST_CONFIG: ProviderConfig = {
  type: 'gitea',
  baseUrl: 'https://gitea.example.com/api/v1',
  token: 'gitea-test-token',
  owner: 'myowner',
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

function getFetchCallCount(): number {
  return (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length
}

function getFetchUrl(index: number): string {
  const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
  return calls[index][0] as string
}

// ---------------------------------------------------------------------------
// Gitea test fixtures
// ---------------------------------------------------------------------------

function makeGiteaUser(overrides?: Record<string, unknown>) {
  return {
    id: 1,
    login: 'testuser',
    full_name: 'Test User',
    avatar_url: 'https://gitea.example.com/avatars/1',
    ...overrides,
  }
}

function makeGiteaPR(overrides?: Record<string, unknown>) {
  return {
    number: 1,
    title: 'Test PR',
    body: 'A test pull request',
    state: 'open',
    is_locked: false,
    user: makeGiteaUser(),
    labels: [{ name: 'bug', color: 'ff0000' }],
    assignees: [makeGiteaUser()],
    requested_reviewers: [makeGiteaUser({ id: 2, login: 'reviewer1' })],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    merged: false,
    head: {
      label: 'testuser:feature',
      ref: 'feature',
      sha: 'abc123',
    },
    base: {
      label: 'main',
      ref: 'main',
      sha: 'def456',
    },
    html_url: 'https://gitea.example.com/myowner/myrepo/pulls/1',
    diff_url: 'https://gitea.example.com/myowner/myrepo/pulls/1.diff',
    comments: 2,
    ...overrides,
  }
}

function makeGiteaReview(overrides?: Record<string, unknown>) {
  return {
    id: 10,
    user: makeGiteaUser(),
    body: 'Looks good!',
    state: 'APPROVED',
    submitted_at: '2026-01-02T00:00:00Z',
    html_url: 'https://gitea.example.com/review/10',
    commit_id: 'abc123',
    ...overrides,
  }
}

function makeGiteaReviewComment(overrides?: Record<string, unknown>) {
  return {
    id: 200,
    body: 'Fix this',
    user: makeGiteaUser(),
    path: 'src/index.ts',
    line: 10,
    old_line_num: 0,
    new_line_num: 10,
    diff_hunk: '@@ -1,5 +1,8 @@',
    pull_request_review_id: 10,
    created_at: '2026-01-02T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    html_url: 'https://gitea.example.com/comment/200',
    commit_id: 'abc123',
    original_commit_id: 'abc123',
    ...overrides,
  }
}

function makeGiteaIssueComment(overrides?: Record<string, unknown>) {
  return {
    id: 100,
    body: 'General comment',
    user: makeGiteaUser(),
    created_at: '2026-01-02T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    html_url: 'https://gitea.example.com/comment/100',
    ...overrides,
  }
}

function makeGiteaChangedFile(overrides?: Record<string, unknown>) {
  return {
    filename: 'src/index.ts',
    status: 'modified',
    additions: 10,
    deletions: 3,
    changes: 13,
    html_url: '',
    contents_url: '',
    ...overrides,
  }
}

function makeGiteaCommit(overrides?: Record<string, unknown>) {
  return {
    sha: 'abc123',
    commit: {
      message: 'feat: add feature',
      author: {
        name: 'Test User',
        email: 'test@example.com',
        date: '2026-01-01T00:00:00Z',
      },
    },
    author: makeGiteaUser(),
    html_url: 'https://gitea.example.com/commit/abc123',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// createGiteaProvider
// ---------------------------------------------------------------------------

describe('createGiteaProvider', () => {
  it('returns a provider with type gitea', () => {
    const provider = createGiteaProvider(TEST_CONFIG)
    expect(provider.type).toBe('gitea')
  })

  it('exposes correct capabilities', () => {
    const provider = createGiteaProvider(TEST_CONFIG)
    expect(provider.capabilities.supportsDraftPR).toBe(false)
    expect(provider.capabilities.supportsReviewThreads).toBe(false)
    expect(provider.capabilities.supportsGraphQL).toBe(false)
    expect(provider.capabilities.supportsReactions).toBe(true)
    expect(provider.capabilities.supportsCheckRuns).toBe(false)
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
    describe('listPRs', () => {
      it('returns items when API responds', async () => {
        const giteaPR = makeGiteaPR()
        mockFetchResponse({ body: [giteaPR] })
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(provider.listPRs({}))
        expect(result.items).toHaveLength(1)
        expect(result.items[0]!.number).toBe(1)
        expect(result.items[0]!.title).toBe('Test PR')
      })

      it('passes state parameter for open', async () => {
        mockFetchResponse({ body: [] })
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(provider.listPRs({ state: 'open' }))
        const url = getLastFetchUrl()
        expect(url).toContain('state=open')
      })

      it('passes state parameter for closed', async () => {
        mockFetchResponse({ body: [] })
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(provider.listPRs({ state: 'closed' }))
        const url = getLastFetchUrl()
        expect(url).toContain('state=closed')
      })

      it('omits state parameter for all', async () => {
        mockFetchResponse({ body: [] })
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(provider.listPRs({ state: 'all' }))
        const url = getLastFetchUrl()
        expect(url).not.toContain('state=')
      })

      it('defaults state to open when no state provided', async () => {
        mockFetchResponse({ body: [] })
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(provider.listPRs({}))
        const url = getLastFetchUrl()
        expect(url).toContain('state=open')
      })

      it('passes perPage and page parameters', async () => {
        mockFetchResponse({ body: [] })
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(
          provider.listPRs({ perPage: 10, page: 2 }),
        )
        const url = getLastFetchUrl()
        expect(url).toContain('limit=10')
        expect(url).toContain('page=2')
      })

      it('defaults perPage to 30 and page to 1', async () => {
        mockFetchResponse({ body: [] })
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(provider.listPRs({}))
        const url = getLastFetchUrl()
        expect(url).toContain('limit=30')
        expect(url).toContain('page=1')
      })

      it('passes sort=newest for created desc', async () => {
        mockFetchResponse({ body: [] })
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(
          provider.listPRs({ sort: 'created', direction: 'desc' }),
        )
        const url = getLastFetchUrl()
        expect(url).toContain('sort=newest')
      })

      it('passes sort=oldest for created asc', async () => {
        mockFetchResponse({ body: [] })
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(
          provider.listPRs({ sort: 'created', direction: 'asc' }),
        )
        const url = getLastFetchUrl()
        expect(url).toContain('sort=oldest')
      })

      it('passes sort=recentupdate for updated desc', async () => {
        mockFetchResponse({ body: [] })
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(
          provider.listPRs({ sort: 'updated', direction: 'desc' }),
        )
        const url = getLastFetchUrl()
        expect(url).toContain('sort=recentupdate')
      })

      it('passes sort=leastupdate for updated asc', async () => {
        mockFetchResponse({ body: [] })
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(
          provider.listPRs({ sort: 'updated', direction: 'asc' }),
        )
        const url = getLastFetchUrl()
        expect(url).toContain('sort=leastupdate')
      })

      it('does not pass sort for unsupported sort type', async () => {
        mockFetchResponse({ body: [] })
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(
          provider.listPRs({ sort: 'popularity' }),
        )
        const url = getLastFetchUrl()
        expect(url).not.toContain('sort=')
      })

      it('returns empty items for empty API response', async () => {
        mockFetchResponse({ body: [] })
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(provider.listPRs({}))
        expect(result.items).toHaveLength(0)
      })
    })

    describe('getPR', () => {
      it('returns a PullRequest when API responds', async () => {
        const giteaPR = makeGiteaPR()
        mockFetchResponse({ body: giteaPR })
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(provider.getPR(1))
        expect(result.number).toBe(1)
        expect(result.title).toBe('Test PR')
        expect(result.state).toBe('open')
      })

      it('maps merged PR correctly', async () => {
        const giteaPR = makeGiteaPR({ state: 'closed', merged: true })
        mockFetchResponse({ body: giteaPR })
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(provider.getPR(1))
        expect(result.state).toBe('closed')
        expect(result.merged).toBe(true)
        expect(result.merged_at).toBe('2026-01-02T00:00:00Z')
      })

      it('maps closed (not merged) PR correctly', async () => {
        const giteaPR = makeGiteaPR({ state: 'closed', merged: false })
        mockFetchResponse({ body: giteaPR })
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(provider.getPR(1))
        expect(result.state).toBe('closed')
        expect(result.merged).toBe(false)
        expect(result.closed_at).toBe('2026-01-02T00:00:00Z')
        expect(result.merged_at).toBeNull()
      })

      it('maps labels from PR', async () => {
        const giteaPR = makeGiteaPR()
        mockFetchResponse({ body: giteaPR })
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(provider.getPR(1))
        expect(result.labels).toHaveLength(1)
        expect(result.labels[0]!.name).toBe('bug')
        expect(result.labels[0]!.color).toBe('ff0000')
      })

      it('maps requested reviewers', async () => {
        const giteaPR = makeGiteaPR()
        mockFetchResponse({ body: giteaPR })
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(provider.getPR(1))
        expect(result.requested_reviewers).toHaveLength(1)
        expect(result.requested_reviewers[0]!.login).toBe('reviewer1')
      })

      it('maps assignees', async () => {
        const giteaPR = makeGiteaPR()
        mockFetchResponse({ body: giteaPR })
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(provider.getPR(1))
        expect(result.assignees).toHaveLength(1)
        expect(result.assignees[0]!.login).toBe('testuser')
      })

      it('maps head and base branch refs', async () => {
        const giteaPR = makeGiteaPR()
        mockFetchResponse({ body: giteaPR })
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(provider.getPR(1))
        expect(result.head.ref).toBe('feature')
        expect(result.head.sha).toBe('abc123')
        expect(result.base.ref).toBe('main')
        expect(result.base.sha).toBe('def456')
      })

      it('calls correct URL', async () => {
        const giteaPR = makeGiteaPR({ number: 42 })
        mockFetchResponse({ body: giteaPR })
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(provider.getPR(42))
        const url = getLastFetchUrl()
        expect(url).toContain('/repos/myowner/myrepo/pulls/42')
      })
    })

    describe('getPRFiles', () => {
      it('returns file changes', async () => {
        const file = makeGiteaChangedFile()
        mockFetchResponse({ body: [file] })
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(provider.getPRFiles(1))
        expect(result).toHaveLength(1)
        expect(result[0]!.filename).toBe('src/index.ts')
        expect(result[0]!.status).toBe('modified')
        expect(result[0]!.additions).toBe(10)
        expect(result[0]!.deletions).toBe(3)
      })

      it('returns empty array when no files', async () => {
        mockFetchResponse({ body: [] })
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(provider.getPRFiles(1))
        expect(result).toHaveLength(0)
      })

      it('maps different file statuses', async () => {
        const files = [
          makeGiteaChangedFile({ filename: 'added.ts', status: 'added' }),
          makeGiteaChangedFile({ filename: 'removed.ts', status: 'removed' }),
          makeGiteaChangedFile({
            filename: 'renamed.ts',
            status: 'renamed',
            previous_filename: 'old-name.ts',
          }),
        ]
        mockFetchResponse({ body: files })
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(provider.getPRFiles(1))
        expect(result).toHaveLength(3)
        expect(result[0]!.status).toBe('added')
        expect(result[1]!.status).toBe('removed')
        expect(result[2]!.status).toBe('renamed')
        expect(result[2]!.previous_filename).toBe('old-name.ts')
      })
    })

    describe('getPRComments', () => {
      it('fetches reviews then review comments for each review', async () => {
        const review = makeGiteaReview()
        const reviewComment = makeGiteaReviewComment()
        mockFetchSequence([
          // First call: fetch reviews (paginated, returns empty on second page)
          { body: [review] },
          // Second call: fetch review comments for review 10
          { body: [reviewComment] },
        ])
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(provider.getPRComments(1))
        expect(result).toHaveLength(1)
        expect(result[0]!.id).toBe(200)
        expect(result[0]!.body).toBe('Fix this')
        expect(result[0]!.path).toBe('src/index.ts')
      })

      it('returns empty when no reviews exist', async () => {
        mockFetchResponse({ body: [] })
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(provider.getPRComments(1))
        expect(result).toHaveLength(0)
      })
    })

    describe('getIssueComments', () => {
      it('returns issue comments', async () => {
        const comment = makeGiteaIssueComment()
        mockFetchResponse({ body: [comment] })
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(provider.getIssueComments(1))
        expect(result).toHaveLength(1)
        expect(result[0]!.id).toBe(100)
        expect(result[0]!.body).toBe('General comment')
      })

      it('returns empty for no comments', async () => {
        mockFetchResponse({ body: [] })
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(provider.getIssueComments(1))
        expect(result).toHaveLength(0)
      })
    })

    describe('getPRReviews', () => {
      it('returns reviews', async () => {
        const review = makeGiteaReview()
        mockFetchResponse({ body: [review] })
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(provider.getPRReviews(1))
        expect(result).toHaveLength(1)
        expect(result[0]!.id).toBe(10)
        expect(result[0]!.state).toBe('APPROVED')
        expect(result[0]!.body).toBe('Looks good!')
      })

      it('maps different review states', async () => {
        const reviews = [
          makeGiteaReview({ id: 1, state: 'APPROVED' }),
          makeGiteaReview({ id: 2, state: 'REQUEST_CHANGES' }),
          makeGiteaReview({ id: 3, state: 'COMMENT' }),
          makeGiteaReview({ id: 4, state: 'PENDING' }),
        ]
        mockFetchResponse({ body: reviews })
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(provider.getPRReviews(1))
        expect(result).toHaveLength(4)
        expect(result[0]!.state).toBe('APPROVED')
        expect(result[1]!.state).toBe('CHANGES_REQUESTED')
        expect(result[2]!.state).toBe('COMMENTED')
        expect(result[3]!.state).toBe('PENDING')
      })

      it('returns empty for no reviews', async () => {
        mockFetchResponse({ body: [] })
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(provider.getPRReviews(1))
        expect(result).toHaveLength(0)
      })
    })

    describe('getPRCommits', () => {
      it('returns commits', async () => {
        const commit = makeGiteaCommit()
        mockFetchResponse({ body: [commit] })
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(provider.getPRCommits(1))
        expect(result).toHaveLength(1)
        expect(result[0]!.sha).toBe('abc123')
        expect(result[0]!.commit.message).toBe('feat: add feature')
        expect(result[0]!.commit.author.name).toBe('Test User')
        expect(result[0]!.commit.author.email).toBe('test@example.com')
      })

      it('handles null author on commit', async () => {
        const commit = makeGiteaCommit({ author: null })
        mockFetchResponse({ body: [commit] })
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(provider.getPRCommits(1))
        expect(result[0]!.author).toBeNull()
      })

      it('returns empty for no commits', async () => {
        mockFetchResponse({ body: [] })
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(provider.getPRCommits(1))
        expect(result).toHaveLength(0)
      })
    })

    describe('getPRChecks', () => {
      it('returns empty check runs response', async () => {
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(
          provider.getPRChecks('abc123'),
        )
        expect(result.total_count).toBe(0)
        expect(result.check_runs).toEqual([])
      })
    })

    describe('getReviewThreads', () => {
      it('returns empty array (not supported)', async () => {
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(
          provider.getReviewThreads(1),
        )
        expect(result).toEqual([])
      })
    })

    describe('getCommitDiff', () => {
      it('returns file changes for a commit', async () => {
        const file = makeGiteaChangedFile()
        mockFetchResponse({ body: [file] })
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(
          provider.getCommitDiff('abc123'),
        )
        expect(result).toHaveLength(1)
        expect(result[0]!.filename).toBe('src/index.ts')
      })

      it('calls correct URL with commit sha', async () => {
        mockFetchResponse({ body: [] })
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(provider.getCommitDiff('sha456'))
        const url = getLastFetchUrl()
        expect(url).toContain('/repos/myowner/myrepo/git/commits/sha456/files')
      })
    })

    describe('getCurrentUser', () => {
      it('returns user login', async () => {
        mockFetchResponse({
          body: { login: 'alice', id: 1 },
        })
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(provider.getCurrentUser())
        expect(result.login).toBe('alice')
      })
    })
  })

  // -----------------------------------------------------------------------
  // User-scoped queries
  // -----------------------------------------------------------------------

  describe('user-scoped queries', () => {
    describe('getMyPRs', () => {
      it('returns only PRs authored by the current user', async () => {
        const myPR = makeGiteaPR({ number: 1 })
        const otherPR = makeGiteaPR({
          number: 2,
          user: makeGiteaUser({ id: 99, login: 'other' }),
        })
        mockFetchSequence([
          // First call: getCurrentUser
          { body: { login: 'testuser', id: 1 } },
          // Second call: fetch all PRs
          { body: [myPR, otherPR] },
        ])
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(provider.getMyPRs())
        expect(result).toHaveLength(1)
        expect(result[0]!.number).toBe(1)
        expect(result[0]!.user.login).toBe('testuser')
      })

      it('returns empty when user has no PRs', async () => {
        const otherPR = makeGiteaPR({
          user: makeGiteaUser({ id: 99, login: 'other' }),
        })
        mockFetchSequence([
          { body: { login: 'testuser', id: 1 } },
          { body: [otherPR] },
        ])
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(provider.getMyPRs())
        expect(result).toHaveLength(0)
      })

      it('passes state filter', async () => {
        mockFetchSequence([
          { body: { login: 'testuser', id: 1 } },
          { body: [] },
        ])
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(provider.getMyPRs('closed'))
        const url = getFetchUrl(1)
        expect(url).toContain('state=closed')
      })

      it('caches the username across calls', async () => {
        const myPR = makeGiteaPR({ number: 1 })
        mockFetchSequence([
          // First call: getCurrentUser
          { body: { login: 'testuser', id: 1 } },
          // Second call: fetch all PRs (first getMyPRs)
          { body: [myPR] },
          // Third call: fetch all PRs (second getMyPRs) - no getCurrentUser needed
          { body: [myPR] },
        ])
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(provider.getMyPRs())
        await Effect.runPromise(provider.getMyPRs())
        // Should have made 3 calls total (1 user + 2 PR list), not 4
        expect(getFetchCallCount()).toBe(3)
      })
    })

    describe('getReviewRequests', () => {
      it('returns only PRs where user is a requested reviewer', async () => {
        const prWithReview = makeGiteaPR({
          number: 1,
          requested_reviewers: [makeGiteaUser()],
        })
        const prWithout = makeGiteaPR({
          number: 2,
          requested_reviewers: [],
        })
        mockFetchSequence([
          { body: { login: 'testuser', id: 1 } },
          { body: [prWithReview, prWithout] },
        ])
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(provider.getReviewRequests())
        expect(result).toHaveLength(1)
        expect(result[0]!.number).toBe(1)
      })

      it('returns empty when user has no review requests', async () => {
        const pr = makeGiteaPR({ requested_reviewers: [] })
        mockFetchSequence([
          { body: { login: 'testuser', id: 1 } },
          { body: [pr] },
        ])
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(provider.getReviewRequests())
        expect(result).toHaveLength(0)
      })

      it('passes state filter', async () => {
        mockFetchSequence([
          { body: { login: 'testuser', id: 1 } },
          { body: [] },
        ])
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(provider.getReviewRequests('open'))
        const url = getFetchUrl(1)
        expect(url).toContain('state=open')
      })
    })

    describe('getInvolvedPRs', () => {
      it('returns PRs where user is author', async () => {
        const authored = makeGiteaPR({
          number: 1,
          user: makeGiteaUser(),
          requested_reviewers: [],
          assignees: [],
        })
        mockFetchSequence([
          { body: { login: 'testuser', id: 1 } },
          { body: [authored] },
        ])
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(provider.getInvolvedPRs())
        expect(result).toHaveLength(1)
      })

      it('returns PRs where user is a reviewer', async () => {
        const review = makeGiteaPR({
          number: 2,
          user: makeGiteaUser({ id: 99, login: 'other' }),
          requested_reviewers: [makeGiteaUser()],
          assignees: [],
        })
        mockFetchSequence([
          { body: { login: 'testuser', id: 1 } },
          { body: [review] },
        ])
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(provider.getInvolvedPRs())
        expect(result).toHaveLength(1)
      })

      it('returns PRs where user is an assignee', async () => {
        const assigned = makeGiteaPR({
          number: 3,
          user: makeGiteaUser({ id: 99, login: 'other' }),
          requested_reviewers: [],
          assignees: [makeGiteaUser()],
        })
        mockFetchSequence([
          { body: { login: 'testuser', id: 1 } },
          { body: [assigned] },
        ])
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(provider.getInvolvedPRs())
        expect(result).toHaveLength(1)
      })

      it('does not duplicate PRs when user is both author and reviewer', async () => {
        const pr = makeGiteaPR({
          number: 1,
          user: makeGiteaUser(),
          requested_reviewers: [makeGiteaUser()],
        })
        mockFetchSequence([
          { body: { login: 'testuser', id: 1 } },
          { body: [pr] },
        ])
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(provider.getInvolvedPRs())
        expect(result).toHaveLength(1)
      })

      it('excludes PRs where user is not involved', async () => {
        const other = makeGiteaPR({
          user: makeGiteaUser({ id: 99, login: 'other' }),
          requested_reviewers: [],
          assignees: [],
        })
        mockFetchSequence([
          { body: { login: 'testuser', id: 1 } },
          { body: [other] },
        ])
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(provider.getInvolvedPRs())
        expect(result).toHaveLength(0)
      })

      it('passes state filter', async () => {
        mockFetchSequence([
          { body: { login: 'testuser', id: 1 } },
          { body: [] },
        ])
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(provider.getInvolvedPRs('all'))
        const url = getFetchUrl(1)
        expect(url).not.toContain('state=')
      })
    })
  })

  // -----------------------------------------------------------------------
  // Review mutations
  // -----------------------------------------------------------------------

  describe('review mutations', () => {
    describe('submitReview', () => {
      it('posts review via mutation helper', async () => {
        mockFetchResponse()
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(
          provider.submitReview(42, 'LGTM!', 'APPROVE'),
        )
        const url = getLastFetchUrl()
        expect(url).toContain('/repos/myowner/myrepo/pulls/42/reviews')
        const body = getLastFetchBody()
        expect(body.event).toBe('APPROVED')
        expect(body.body).toBe('LGTM!')
      })

      it('maps APPROVE to APPROVED', async () => {
        mockFetchResponse()
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(
          provider.submitReview(1, '', 'APPROVE'),
        )
        const body = getLastFetchBody()
        expect(body.event).toBe('APPROVED')
      })

      it('passes REQUEST_CHANGES as-is', async () => {
        mockFetchResponse()
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(
          provider.submitReview(1, 'Fix it', 'REQUEST_CHANGES'),
        )
        const body = getLastFetchBody()
        expect(body.event).toBe('REQUEST_CHANGES')
      })

      it('passes COMMENT as-is', async () => {
        mockFetchResponse()
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(
          provider.submitReview(1, 'Note', 'COMMENT'),
        )
        const body = getLastFetchBody()
        expect(body.event).toBe('COMMENT')
      })
    })

    describe('createPendingReview', () => {
      it('returns dummy id=0', async () => {
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(
          provider.createPendingReview(42),
        )
        expect(result.id).toBe(0)
      })
    })

    describe('addPendingReviewComment', () => {
      it('posts inline comment via review endpoint', async () => {
        mockFetchResponse()
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(
          provider.addPendingReviewComment({
            prNumber: 42,
            reviewId: 0,
            body: 'Fix this',
            path: 'src/foo.ts',
            line: 10,
            side: 'RIGHT',
          }),
        )
        const url = getLastFetchUrl()
        expect(url).toContain('/repos/myowner/myrepo/pulls/42/reviews')
        const body = getLastFetchBody()
        expect(body.event).toBe('COMMENT')
        expect((body.comments as Array<Record<string, unknown>>)[0]!.path).toBe(
          'src/foo.ts',
        )
        expect(
          (body.comments as Array<Record<string, unknown>>)[0]!.new_position,
        ).toBe(10)
      })

      it('sets old_position for LEFT side', async () => {
        mockFetchResponse()
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(
          provider.addPendingReviewComment({
            prNumber: 42,
            reviewId: 0,
            body: 'Old line',
            path: 'src/bar.ts',
            line: 5,
            side: 'LEFT',
          }),
        )
        const body = getLastFetchBody()
        const comment = (
          body.comments as Array<Record<string, unknown>>
        )[0]!
        expect(comment.old_position).toBe(5)
        expect(comment.new_position).toBe(0)
      })
    })

    describe('submitPendingReview', () => {
      it('submits review with correct event', async () => {
        mockFetchResponse()
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(
          provider.submitPendingReview(42, 0, 'Done', 'APPROVE'),
        )
        const body = getLastFetchBody()
        expect(body.event).toBe('APPROVED')
        expect(body.body).toBe('Done')
      })
    })

    describe('discardPendingReview', () => {
      it('succeeds as no-op', async () => {
        const provider = createGiteaProvider(TEST_CONFIG)
        const result = await Effect.runPromise(
          provider.discardPendingReview(42, 0),
        )
        expect(result).toBeUndefined()
      })
    })
  })

  // -----------------------------------------------------------------------
  // Comment mutations
  // -----------------------------------------------------------------------

  describe('comment mutations', () => {
    describe('addComment', () => {
      it('posts issue comment', async () => {
        mockFetchResponse()
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(provider.addComment(42, 'Hello!'))
        const url = getLastFetchUrl()
        expect(url).toContain(
          '/repos/myowner/myrepo/issues/42/comments',
        )
        const body = getLastFetchBody()
        expect(body.body).toBe('Hello!')
      })
    })

    describe('addDiffComment', () => {
      it('posts inline comment with RIGHT side', async () => {
        mockFetchResponse()
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(
          provider.addDiffComment({
            prNumber: 42,
            body: 'Fix this line',
            commitId: 'abc123',
            path: 'src/foo.ts',
            line: 10,
            side: 'RIGHT',
          }),
        )
        const url = getLastFetchUrl()
        expect(url).toContain('/repos/myowner/myrepo/pulls/42/reviews')
        const body = getLastFetchBody()
        expect(body.event).toBe('COMMENT')
        const comments = body.comments as Array<Record<string, unknown>>
        expect(comments[0]!.path).toBe('src/foo.ts')
        expect(comments[0]!.new_position).toBe(10)
        expect(comments[0]!.old_position).toBe(0)
      })

      it('posts inline comment with LEFT side', async () => {
        mockFetchResponse()
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(
          provider.addDiffComment({
            prNumber: 42,
            body: 'Old line',
            commitId: 'abc123',
            path: 'src/foo.ts',
            line: 5,
            side: 'LEFT',
          }),
        )
        const body = getLastFetchBody()
        const comments = body.comments as Array<Record<string, unknown>>
        expect(comments[0]!.old_position).toBe(5)
        expect(comments[0]!.new_position).toBe(0)
      })
    })

    describe('replyToComment', () => {
      it('falls back to adding issue comment', async () => {
        mockFetchResponse()
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(
          provider.replyToComment(42, 99, 'Thanks!'),
        )
        const url = getLastFetchUrl()
        expect(url).toContain('/repos/myowner/myrepo/issues/42/comments')
        const body = getLastFetchBody()
        expect(body.body).toBe('Thanks!')
      })
    })

    describe('editIssueComment', () => {
      it('patches issue comment', async () => {
        mockFetchResponse()
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(
          provider.editIssueComment(100, 'Updated text'),
        )
        const url = getLastFetchUrl()
        expect(url).toContain(
          '/repos/myowner/myrepo/issues/comments/100',
        )
        const body = getLastFetchBody()
        expect(body.body).toBe('Updated text')
        expect(getLastFetchMethod()).toBe('PATCH')
      })
    })

    describe('editReviewComment', () => {
      it('uses same endpoint as editIssueComment', async () => {
        mockFetchResponse()
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(
          provider.editReviewComment(200, 'Fixed'),
        )
        const url = getLastFetchUrl()
        expect(url).toContain(
          '/repos/myowner/myrepo/issues/comments/200',
        )
      })
    })

    describe('deleteReviewComment', () => {
      it('deletes issue comment', async () => {
        mockFetchResponse()
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(provider.deleteReviewComment(200))
        const url = getLastFetchUrl()
        expect(url).toContain(
          '/repos/myowner/myrepo/issues/comments/200',
        )
        expect(getLastFetchMethod()).toBe('DELETE')
      })
    })
  })

  // -----------------------------------------------------------------------
  // PR state mutations
  // -----------------------------------------------------------------------

  describe('PR state mutations', () => {
    describe('mergePR', () => {
      it('sends POST to merge endpoint with Do field', async () => {
        mockFetchResponse()
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(provider.mergePR(42, 'merge'))
        const url = getLastFetchUrl()
        expect(url).toContain('/repos/myowner/myrepo/pulls/42/merge')
        const body = getLastFetchBody()
        expect(body.Do).toBe('merge')
        expect(getLastFetchMethod()).toBe('POST')
      })

      it('sends squash method', async () => {
        mockFetchResponse()
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(provider.mergePR(42, 'squash'))
        const body = getLastFetchBody()
        expect(body.Do).toBe('squash')
      })

      it('sends rebase method', async () => {
        mockFetchResponse()
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(provider.mergePR(42, 'rebase'))
        const body = getLastFetchBody()
        expect(body.Do).toBe('rebase')
      })

      it('includes merge message with title only', async () => {
        mockFetchResponse()
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(
          provider.mergePR(42, 'squash', 'Squash title'),
        )
        const body = getLastFetchBody()
        expect(body.merge_message_field).toBe('Squash title')
      })

      it('includes merge message with title and body', async () => {
        mockFetchResponse()
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(
          provider.mergePR(42, 'merge', 'Title', 'Body text'),
        )
        const body = getLastFetchBody()
        expect(body.merge_message_field).toBe('Title\n\nBody text')
      })

      it('omits merge_message_field when no title', async () => {
        mockFetchResponse()
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(provider.mergePR(42, 'merge'))
        const body = getLastFetchBody()
        expect(body.merge_message_field).toBeUndefined()
      })
    })

    describe('closePR', () => {
      it('patches PR state to closed', async () => {
        mockFetchResponse()
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(provider.closePR(42))
        const url = getLastFetchUrl()
        expect(url).toContain('/repos/myowner/myrepo/pulls/42')
        const body = getLastFetchBody()
        expect(body.state).toBe('closed')
        expect(getLastFetchMethod()).toBe('PATCH')
      })
    })

    describe('reopenPR', () => {
      it('patches PR state to open', async () => {
        mockFetchResponse()
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(provider.reopenPR(42))
        const url = getLastFetchUrl()
        expect(url).toContain('/repos/myowner/myrepo/pulls/42')
        const body = getLastFetchBody()
        expect(body.state).toBe('open')
        expect(getLastFetchMethod()).toBe('PATCH')
      })
    })

    describe('updatePRTitle', () => {
      it('patches PR title', async () => {
        mockFetchResponse()
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(
          provider.updatePRTitle(42, 'New Title'),
        )
        const body = getLastFetchBody()
        expect(body.title).toBe('New Title')
        expect(getLastFetchMethod()).toBe('PATCH')
      })
    })

    describe('updatePRBody', () => {
      it('patches PR body', async () => {
        mockFetchResponse()
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(
          provider.updatePRBody(42, 'New description'),
        )
        const body = getLastFetchBody()
        expect(body.body).toBe('New description')
        expect(getLastFetchMethod()).toBe('PATCH')
      })
    })

    describe('requestReReview', () => {
      it('posts requested reviewers', async () => {
        mockFetchResponse()
        const provider = createGiteaProvider(TEST_CONFIG)
        await Effect.runPromise(
          provider.requestReReview(42, ['alice', 'bob']),
        )
        const url = getLastFetchUrl()
        expect(url).toContain(
          '/repos/myowner/myrepo/pulls/42/requested_reviewers',
        )
        const body = getLastFetchBody()
        expect(body.reviewers).toEqual(['alice', 'bob'])
        expect(getLastFetchMethod()).toBe('POST')
      })

      it('fails when no reviewers provided', async () => {
        const provider = createGiteaProvider(TEST_CONFIG)
        const exit = await Effect.runPromiseExit(
          provider.requestReReview(42, []),
        )
        expect(Exit.isFailure(exit)).toBe(true)
      })
    })
  })

  // -----------------------------------------------------------------------
  // Unsupported operations
  // -----------------------------------------------------------------------

  describe('unsupported operations', () => {
    it('resolveThread fails with descriptive error', async () => {
      const provider = createGiteaProvider(TEST_CONFIG)
      const exit = await Effect.runPromiseExit(
        provider.resolveThread('thread-1'),
      )
      expect(Exit.isFailure(exit)).toBe(true)
    })

    it('unresolveThread fails with descriptive error', async () => {
      const provider = createGiteaProvider(TEST_CONFIG)
      const exit = await Effect.runPromiseExit(
        provider.unresolveThread('thread-1'),
      )
      expect(Exit.isFailure(exit)).toBe(true)
    })

    it('convertToDraft fails with descriptive error', async () => {
      const provider = createGiteaProvider(TEST_CONFIG)
      const exit = await Effect.runPromiseExit(
        provider.convertToDraft('node-id'),
      )
      expect(Exit.isFailure(exit)).toBe(true)
    })

    it('markReadyForReview fails with descriptive error', async () => {
      const provider = createGiteaProvider(TEST_CONFIG)
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

describe('createProvider with gitea type', () => {
  it('creates a Gitea provider for type gitea', () => {
    const mockService = {} as never
    const provider = createProvider(TEST_CONFIG, mockService)
    expect(provider.type).toBe('gitea')
  })

  it('Gitea provider has merge, squash and rebase strategies', () => {
    const mockService = {} as never
    const provider = createProvider(TEST_CONFIG, mockService)
    expect(provider.capabilities.supportsMergeStrategies).toEqual([
      'merge',
      'squash',
      'rebase',
    ])
  })

  it('Gitea provider does not support drafts, threads, or GraphQL', () => {
    const mockService = {} as never
    const provider = createProvider(TEST_CONFIG, mockService)
    expect(provider.capabilities.supportsDraftPR).toBe(false)
    expect(provider.capabilities.supportsReviewThreads).toBe(false)
    expect(provider.capabilities.supportsGraphQL).toBe(false)
  })

  it('Gitea provider supports reactions', () => {
    const mockService = {} as never
    const provider = createProvider(TEST_CONFIG, mockService)
    expect(provider.capabilities.supportsReactions).toBe(true)
  })

  it('Gitea provider does not support check runs', () => {
    const mockService = {} as never
    const provider = createProvider(TEST_CONFIG, mockService)
    expect(provider.capabilities.supportsCheckRuns).toBe(false)
  })
})
