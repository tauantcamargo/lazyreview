import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect } from 'effect'
import { createGitLabProvider } from './gitlab'
import type { Provider, ProviderConfig } from './types'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TEST_CONFIG: ProviderConfig = {
  type: 'gitlab',
  baseUrl: 'https://gitlab.example.com/api/v4',
  token: 'test-token-123',
  owner: 'myorg',
  repo: 'myrepo',
}

const ENCODED_PROJECT = encodeURIComponent('myorg/myrepo')

function makeGitLabMR(overrides: Record<string, unknown> = {}) {
  return {
    id: 100,
    iid: 42,
    title: 'Add feature X',
    description: 'This MR adds feature X',
    state: 'opened',
    draft: false,
    source_branch: 'feature-x',
    target_branch: 'main',
    author: {
      id: 1,
      username: 'johndoe',
      name: 'John Doe',
      avatar_url: 'https://gitlab.example.com/avatar.png',
      web_url: 'https://gitlab.example.com/johndoe',
    },
    assignees: [],
    reviewers: [],
    labels: ['bug', 'priority'],
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-16T12:00:00Z',
    merged_at: null,
    closed_at: null,
    merge_commit_sha: null,
    sha: 'abc123def456',
    diff_refs: {
      base_sha: 'base111',
      head_sha: 'head222',
      start_sha: 'start333',
    },
    web_url: 'https://gitlab.example.com/myorg/myrepo/-/merge_requests/42',
    user_notes_count: 5,
    has_conflicts: false,
    merge_status: 'can_be_merged',
    head_pipeline: null,
    ...overrides,
  }
}

function makeGitLabNote(overrides: Record<string, unknown> = {}) {
  return {
    id: 200,
    body: 'Looks good to me!',
    author: {
      id: 1,
      username: 'reviewer',
      name: 'Reviewer',
      avatar_url: 'https://gitlab.example.com/reviewer.png',
      web_url: 'https://gitlab.example.com/reviewer',
    },
    created_at: '2026-01-16T14:00:00Z',
    updated_at: '2026-01-16T14:00:00Z',
    system: false,
    resolvable: false,
    resolved: false,
    resolved_by: null,
    type: null,
    ...overrides,
  }
}

function makeGitLabDiff(overrides: Record<string, unknown> = {}) {
  return {
    old_path: 'src/old.ts',
    new_path: 'src/new.ts',
    a_mode: '100644',
    b_mode: '100644',
    diff: '@@ -1,3 +1,5 @@\n+added line\n context\n-removed line\n context',
    new_file: false,
    renamed_file: true,
    deleted_file: false,
    ...overrides,
  }
}

function makeGitLabCommit(overrides: Record<string, unknown> = {}) {
  return {
    id: 'abc123def456789',
    short_id: 'abc123d',
    title: 'feat: add feature X',
    message: 'feat: add feature X\n\nDetailed description here.',
    author_name: 'John Doe',
    author_email: 'john@example.com',
    authored_date: '2026-01-15T10:00:00Z',
    committed_date: '2026-01-15T10:30:00Z',
    web_url: 'https://gitlab.example.com/myorg/myrepo/-/commit/abc123def456789',
    ...overrides,
  }
}

function makeGitLabJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 300,
    name: 'test',
    status: 'success',
    stage: 'test',
    web_url: 'https://gitlab.example.com/myorg/myrepo/-/jobs/300',
    started_at: '2026-01-15T10:00:00Z',
    finished_at: '2026-01-15T10:05:00Z',
    allow_failure: false,
    ...overrides,
  }
}

function makeGitLabDiscussion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'disc-001',
    individual_note: false,
    notes: [
      makeGitLabNote({
        id: 201,
        resolvable: true,
        resolved: false,
        position: {
          base_sha: 'base111',
          head_sha: 'head222',
          start_sha: 'start333',
          old_path: 'src/file.ts',
          new_path: 'src/file.ts',
          old_line: null,
          new_line: 10,
        },
      }),
    ],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

let provider: Provider
let mockFetch: ReturnType<typeof vi.fn>

function mockFetchResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers({
      'content-type': 'application/json',
      ...headers,
    }),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  })
}

/**
 * Set up mock fetch to respond based on URL patterns.
 * Each entry maps a URL substring to a response.
 */
function setupMockRoutes(routes: Record<string, unknown>) {
  mockFetch.mockImplementation((url: string) => {
    for (const [pattern, body] of Object.entries(routes)) {
      if (url.includes(pattern)) {
        return mockFetchResponse(body)
      }
    }
    return mockFetchResponse({ error: 'Not found' }, 404)
  })
}

beforeEach(() => {
  mockFetch = vi.fn()
  global.fetch = mockFetch as unknown as typeof fetch
  provider = createGitLabProvider(TEST_CONFIG)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GitLab provider - capabilities', () => {
  it('should have type gitlab', () => {
    expect(provider.type).toBe('gitlab')
  })

  it('should support draft PRs', () => {
    expect(provider.capabilities.supportsDraftPR).toBe(true)
  })

  it('should support review threads', () => {
    expect(provider.capabilities.supportsReviewThreads).toBe(true)
  })

  it('should support check runs (pipelines)', () => {
    expect(provider.capabilities.supportsCheckRuns).toBe(true)
  })

  it('should support merge, squash, and rebase strategies', () => {
    expect(provider.capabilities.supportsMergeStrategies).toEqual([
      'merge',
      'squash',
      'rebase',
    ])
  })
})

describe('GitLab provider - listPRs', () => {
  it('should fetch merge requests and map to PRListResult', async () => {
    const mrs = [makeGitLabMR(), makeGitLabMR({ iid: 43, title: 'Second MR' })]
    mockFetch.mockResolvedValueOnce(mockFetchResponse(mrs))

    const result = await Effect.runPromise(provider.listPRs({}))

    expect(result.items).toHaveLength(2)
    expect(result.items[0]!.number).toBe(42)
    expect(result.items[0]!.title).toBe('Add feature X')
    expect(result.items[0]!.state).toBe('open')
    expect(result.items[1]!.number).toBe(43)
  })

  it('should map state "open" to GitLab "opened"', async () => {
    mockFetch.mockResolvedValueOnce(mockFetchResponse([]))

    await Effect.runPromise(provider.listPRs({ state: 'open' }))

    const calledUrl = mockFetch.mock.calls[0]![0] as string
    expect(calledUrl).toContain('state=opened')
  })

  it('should map state "closed" to GitLab "closed"', async () => {
    mockFetch.mockResolvedValueOnce(mockFetchResponse([]))

    await Effect.runPromise(provider.listPRs({ state: 'closed' }))

    const calledUrl = mockFetch.mock.calls[0]![0] as string
    expect(calledUrl).toContain('state=closed')
  })

  it('should use perPage and page params', async () => {
    mockFetch.mockResolvedValueOnce(mockFetchResponse([]))

    await Effect.runPromise(
      provider.listPRs({ perPage: 10, page: 2 }),
    )

    const calledUrl = mockFetch.mock.calls[0]![0] as string
    expect(calledUrl).toContain('per_page=10')
    expect(calledUrl).toContain('page=2')
  })

  it('should map "merged" state MR to closed with merged=true', async () => {
    const mergedMR = makeGitLabMR({
      state: 'merged',
      merged_at: '2026-01-17T10:00:00Z',
    })
    mockFetch.mockResolvedValueOnce(mockFetchResponse([mergedMR]))

    const result = await Effect.runPromise(provider.listPRs({ state: 'all' }))

    expect(result.items[0]!.state).toBe('closed')
    expect(result.items[0]!.merged).toBe(true)
  })
})

describe('GitLab provider - getPR', () => {
  it('should fetch a single MR and map to PullRequest', async () => {
    mockFetch.mockResolvedValueOnce(mockFetchResponse(makeGitLabMR()))

    const pr = await Effect.runPromise(provider.getPR(42))

    expect(pr.number).toBe(42)
    expect(pr.title).toBe('Add feature X')
    expect(pr.user.login).toBe('johndoe')
    expect(pr.head.ref).toBe('feature-x')
    expect(pr.base.ref).toBe('main')
  })

  it('should encode project path in URL', async () => {
    mockFetch.mockResolvedValueOnce(mockFetchResponse(makeGitLabMR()))

    await Effect.runPromise(provider.getPR(42))

    const calledUrl = mockFetch.mock.calls[0]![0] as string
    expect(calledUrl).toContain(`/projects/${ENCODED_PROJECT}/merge_requests/42`)
  })

  it('should use PRIVATE-TOKEN header', async () => {
    mockFetch.mockResolvedValueOnce(mockFetchResponse(makeGitLabMR()))

    await Effect.runPromise(provider.getPR(42))

    const calledOptions = mockFetch.mock.calls[0]![1] as RequestInit
    const headers = calledOptions.headers as Record<string, string>
    expect(headers['PRIVATE-TOKEN']).toBe('test-token-123')
  })

  it('should map draft MR correctly', async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse(makeGitLabMR({ draft: true })),
    )

    const pr = await Effect.runPromise(provider.getPR(42))

    expect(pr.draft).toBe(true)
  })
})

describe('GitLab provider - getPRFiles', () => {
  it('should fetch diffs and map to FileChange array', async () => {
    const diffs = [
      makeGitLabDiff(),
      makeGitLabDiff({
        old_path: 'src/added.ts',
        new_path: 'src/added.ts',
        new_file: true,
        renamed_file: false,
        diff: '+new file content',
      }),
    ]
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse(diffs, 200, { 'x-next-page': '' }),
    )

    const files = await Effect.runPromise(provider.getPRFiles(42))

    expect(files).toHaveLength(2)
    expect(files[0]!.filename).toBe('src/new.ts')
    expect(files[0]!.status).toBe('renamed')
    expect(files[0]!.previous_filename).toBe('src/old.ts')
    expect(files[1]!.status).toBe('added')
  })

  it('should count additions and deletions from diff patch', async () => {
    const diffs = [
      makeGitLabDiff({
        diff: '@@ -1,3 +1,5 @@\n+line1\n+line2\n context\n-removed\n context',
      }),
    ]
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse(diffs, 200, { 'x-next-page': '' }),
    )

    const files = await Effect.runPromise(provider.getPRFiles(42))

    expect(files[0]!.additions).toBe(2)
    expect(files[0]!.deletions).toBe(1)
    expect(files[0]!.changes).toBe(3)
  })
})

describe('GitLab provider - getPRComments', () => {
  it('should fetch notes with position and map to Comment', async () => {
    const diffNote = makeGitLabNote({
      id: 201,
      body: 'Fix this line',
      position: {
        base_sha: 'base111',
        head_sha: 'head222',
        start_sha: 'start333',
        old_path: 'src/file.ts',
        new_path: 'src/file.ts',
        old_line: null,
        new_line: 15,
      },
    })
    const generalNote = makeGitLabNote({ id: 202, body: 'General comment' })

    setupMockRoutes({
      '/notes': [diffNote, generalNote],
      '/merge_requests/42': makeGitLabMR(),
    })

    const comments = await Effect.runPromise(provider.getPRComments(42))

    // Only the diff note should be returned
    expect(comments).toHaveLength(1)
    expect(comments[0]!.body).toBe('Fix this line')
    expect(comments[0]!.path).toBe('src/file.ts')
    expect(comments[0]!.line).toBe(15)
  })

  it('should exclude system notes', async () => {
    const systemNote = makeGitLabNote({
      system: true,
      body: 'merged',
      position: {
        base_sha: 'a',
        head_sha: 'b',
        start_sha: 'c',
        old_path: 'x',
        new_path: 'x',
        old_line: null,
        new_line: 1,
      },
    })

    setupMockRoutes({
      '/notes': [systemNote],
      '/merge_requests/42': makeGitLabMR(),
    })

    const comments = await Effect.runPromise(provider.getPRComments(42))

    expect(comments).toHaveLength(0)
  })
})

describe('GitLab provider - getIssueComments', () => {
  it('should fetch notes without position and map to IssueComment', async () => {
    const generalNote = makeGitLabNote({ id: 202, body: 'General comment' })
    const diffNote = makeGitLabNote({
      id: 201,
      position: {
        base_sha: 'a',
        head_sha: 'b',
        start_sha: 'c',
        old_path: 'x',
        new_path: 'x',
        old_line: null,
        new_line: 1,
      },
    })

    setupMockRoutes({
      '/notes': [generalNote, diffNote],
      '/merge_requests/42': makeGitLabMR(),
    })

    const comments = await Effect.runPromise(provider.getIssueComments(42))

    // Only the general note without position should be returned
    expect(comments).toHaveLength(1)
    expect(comments[0]!.body).toBe('General comment')
  })
})

describe('GitLab provider - getPRReviews', () => {
  it('should fetch approvals and map to Review array', async () => {
    const approvals = {
      approved: true,
      approved_by: [
        {
          user: {
            id: 10,
            username: 'approver1',
            name: 'Approver One',
            avatar_url: 'https://example.com/a1.png',
            web_url: 'https://gitlab.example.com/approver1',
          },
        },
      ],
    }

    setupMockRoutes({
      '/approvals': approvals,
      '/merge_requests/42': makeGitLabMR(),
    })

    const reviews = await Effect.runPromise(provider.getPRReviews(42))

    expect(reviews).toHaveLength(1)
    expect(reviews[0]!.state).toBe('APPROVED')
    expect(reviews[0]!.user.login).toBe('approver1')
  })

  it('should return empty array when no approvals', async () => {
    const approvals = {
      approved: false,
      approved_by: [],
    }

    setupMockRoutes({
      '/approvals': approvals,
      '/merge_requests/42': makeGitLabMR(),
    })

    const reviews = await Effect.runPromise(provider.getPRReviews(42))

    expect(reviews).toHaveLength(0)
  })
})

describe('GitLab provider - getPRCommits', () => {
  it('should fetch commits and map to Commit array', async () => {
    const commits = [
      makeGitLabCommit(),
      makeGitLabCommit({
        id: 'def456789',
        title: 'fix: resolve bug',
        message: 'fix: resolve bug',
      }),
    ]
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse(commits, 200, { 'x-next-page': '' }),
    )

    const result = await Effect.runPromise(provider.getPRCommits(42))

    expect(result).toHaveLength(2)
    expect(result[0]!.sha).toBe('abc123def456789')
    expect(result[0]!.commit.message).toBe(
      'feat: add feature X\n\nDetailed description here.',
    )
    expect(result[0]!.commit.author.name).toBe('John Doe')
    expect(result[1]!.sha).toBe('def456789')
  })
})

describe('GitLab provider - getPRChecks', () => {
  it('should fetch pipeline jobs and map to CheckRunsResponse', async () => {
    const pipelines = [{ id: 500, status: 'success', ref: 'main', sha: 'abc123', web_url: '' }]
    const jobs = [
      makeGitLabJob({ id: 301, name: 'lint', status: 'success', stage: 'lint' }),
      makeGitLabJob({ id: 302, name: 'test', status: 'failed', stage: 'test' }),
      makeGitLabJob({ id: 303, name: 'deploy', status: 'running', stage: 'deploy' }),
    ]

    mockFetch
      .mockResolvedValueOnce(mockFetchResponse(pipelines))
      .mockResolvedValueOnce(
        mockFetchResponse(jobs, 200, { 'x-next-page': '' }),
      )

    const result = await Effect.runPromise(provider.getPRChecks('abc123'))

    expect(result.total_count).toBe(3)
    expect(result.check_runs).toHaveLength(3)
    expect(result.check_runs[0]!.name).toBe('lint / lint')
    expect(result.check_runs[0]!.status).toBe('completed')
    expect(result.check_runs[0]!.conclusion).toBe('success')
    expect(result.check_runs[1]!.status).toBe('completed')
    expect(result.check_runs[1]!.conclusion).toBe('failure')
    expect(result.check_runs[2]!.status).toBe('in_progress')
    expect(result.check_runs[2]!.conclusion).toBeNull()
  })

  it('should return empty response when no pipelines exist', async () => {
    mockFetch.mockResolvedValueOnce(mockFetchResponse([]))

    const result = await Effect.runPromise(provider.getPRChecks('abc123'))

    expect(result.total_count).toBe(0)
    expect(result.check_runs).toHaveLength(0)
  })
})

describe('GitLab provider - getReviewThreads', () => {
  it('should fetch discussions and map to ReviewThread array', async () => {
    const discussions = [
      makeGitLabDiscussion(),
      makeGitLabDiscussion({
        id: 'disc-002',
        notes: [
          makeGitLabNote({
            id: 202,
            resolvable: true,
            resolved: true,
            position: {
              base_sha: 'a',
              head_sha: 'b',
              start_sha: 'c',
              old_path: 'x',
              new_path: 'x',
              old_line: null,
              new_line: 5,
            },
          }),
        ],
      }),
    ]

    mockFetch.mockResolvedValueOnce(
      mockFetchResponse(discussions, 200, { 'x-next-page': '' }),
    )

    const threads = await Effect.runPromise(provider.getReviewThreads(42))

    expect(threads).toHaveLength(2)
    expect(threads[0]!.id).toBe('disc-001')
    expect(threads[0]!.isResolved).toBe(false)
    expect(threads[1]!.id).toBe('disc-002')
    expect(threads[1]!.isResolved).toBe(true)
  })

  it('should filter out individual notes (non-threaded)', async () => {
    const discussions = [
      makeGitLabDiscussion({ individual_note: true }),
    ]

    mockFetch.mockResolvedValueOnce(
      mockFetchResponse(discussions, 200, { 'x-next-page': '' }),
    )

    const threads = await Effect.runPromise(provider.getReviewThreads(42))

    expect(threads).toHaveLength(0)
  })

  it('should filter out system note discussions', async () => {
    const discussions = [
      makeGitLabDiscussion({
        notes: [makeGitLabNote({ system: true, resolvable: true })],
      }),
    ]

    mockFetch.mockResolvedValueOnce(
      mockFetchResponse(discussions, 200, { 'x-next-page': '' }),
    )

    const threads = await Effect.runPromise(provider.getReviewThreads(42))

    expect(threads).toHaveLength(0)
  })
})

describe('GitLab provider - getCommitDiff', () => {
  it('should fetch commit diff and map to FileChange array', async () => {
    const diffs = [
      makeGitLabDiff({ new_path: 'src/changed.ts', renamed_file: false }),
    ]
    mockFetch.mockResolvedValueOnce(mockFetchResponse(diffs))

    const files = await Effect.runPromise(provider.getCommitDiff('abc123'))

    expect(files).toHaveLength(1)
    expect(files[0]!.filename).toBe('src/changed.ts')
    expect(files[0]!.status).toBe('modified')
  })
})

describe('GitLab provider - user-scoped queries', () => {
  it('getMyPRs should call /merge_requests with scope=created_by_me', async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse([makeGitLabMR()], 200, { 'x-next-page': '' }),
    )

    const prs = await Effect.runPromise(provider.getMyPRs())

    expect(prs).toHaveLength(1)
    expect(prs[0]!.number).toBe(42)

    const calledUrl = mockFetch.mock.calls[0]![0] as string
    expect(calledUrl).toContain('scope=created_by_me')
    expect(calledUrl).toContain('state=opened')
  })

  it('getReviewRequests should fetch current user then query by reviewer_username', async () => {
    // First call: /user
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse({
        id: 1,
        username: 'johndoe',
        name: 'John',
        avatar_url: null,
        web_url: 'https://gitlab.example.com/johndoe',
      }),
    )
    // Second call: /merge_requests
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse([makeGitLabMR()], 200, { 'x-next-page': '' }),
    )

    const prs = await Effect.runPromise(provider.getReviewRequests())

    expect(prs).toHaveLength(1)

    // Check second call has reviewer_username
    const secondCallUrl = mockFetch.mock.calls[1]![0] as string
    expect(secondCallUrl).toContain('reviewer_username=johndoe')
  })

  it('getInvolvedPRs should call /merge_requests with scope=all', async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse([makeGitLabMR()], 200, { 'x-next-page': '' }),
    )

    const prs = await Effect.runPromise(provider.getInvolvedPRs('closed'))

    expect(prs).toHaveLength(1)

    const calledUrl = mockFetch.mock.calls[0]![0] as string
    expect(calledUrl).toContain('scope=all')
    expect(calledUrl).toContain('state=closed')
  })
})

describe('GitLab provider - getCurrentUser', () => {
  it('should fetch current user and return login', async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse({
        id: 1,
        username: 'johndoe',
        name: 'John Doe',
        avatar_url: 'https://gitlab.example.com/avatar.png',
        web_url: 'https://gitlab.example.com/johndoe',
      }),
    )

    const user = await Effect.runPromise(provider.getCurrentUser())

    expect(user.login).toBe('johndoe')
  })
})

describe('GitLab provider - thread ID encoding', () => {
  it('encodeThreadId should produce "iid:discussionId"', async () => {
    const { encodeThreadId } = await import('./gitlab')
    expect(encodeThreadId(42, 'disc-001')).toBe('42:disc-001')
  })

  it('decodeThreadId should split iid and discussionId', async () => {
    const { decodeThreadId } = await import('./gitlab')
    const result = decodeThreadId('42:disc-001')
    expect(result.iid).toBe(42)
    expect(result.discussionId).toBe('disc-001')
  })

  it('decodeThreadId should handle missing separator', async () => {
    const { decodeThreadId } = await import('./gitlab')
    const result = decodeThreadId('disc-only')
    expect(result.iid).toBe(0)
    expect(result.discussionId).toBe('disc-only')
  })
})

describe('GitLab provider - state mapping', () => {
  it('should map labels from string array to Label objects', async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse(makeGitLabMR({ labels: ['bug', 'urgent'] })),
    )

    const pr = await Effect.runPromise(provider.getPR(42))

    expect(pr.labels).toHaveLength(2)
    expect(pr.labels[0]!.name).toBe('bug')
    expect(pr.labels[1]!.name).toBe('urgent')
  })

  it('should map reviewers to requested_reviewers', async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse(
        makeGitLabMR({
          reviewers: [
            {
              id: 5,
              username: 'reviewer1',
              name: 'Reviewer One',
              avatar_url: null,
              web_url: 'https://gitlab.example.com/reviewer1',
            },
          ],
        }),
      ),
    )

    const pr = await Effect.runPromise(provider.getPR(42))

    expect(pr.requested_reviewers).toHaveLength(1)
    expect(pr.requested_reviewers[0]!.login).toBe('reviewer1')
  })

  it('should map head and base branch refs', async () => {
    mockFetch.mockResolvedValueOnce(mockFetchResponse(makeGitLabMR()))

    const pr = await Effect.runPromise(provider.getPR(42))

    expect(pr.head.ref).toBe('feature-x')
    expect(pr.head.sha).toBe('abc123def456')
    expect(pr.base.ref).toBe('main')
    expect(pr.base.sha).toBe('base111')
  })
})
