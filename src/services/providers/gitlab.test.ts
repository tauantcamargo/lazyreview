import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect, Exit } from 'effect'
import { createGitLabProvider, encodeThreadId, decodeThreadId } from './gitlab'
import { createProvider } from './index'
import { GitHubError } from '../../models/errors'
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
  type: 'gitlab',
  baseUrl: 'https://gitlab.com/api/v4',
  token: 'glpat-test123',
  owner: 'myorg',
  repo: 'myrepo',
}

const ENCODED_PATH = 'myorg%2Fmyrepo'

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
// Thread ID encoding/decoding
// ---------------------------------------------------------------------------

describe('encodeThreadId', () => {
  it('encodes iid and discussionId', () => {
    expect(encodeThreadId(42, 'disc-abc')).toBe('42:disc-abc')
  })

  it('handles large iid values', () => {
    expect(encodeThreadId(999999, 'xyz')).toBe('999999:xyz')
  })
})

describe('decodeThreadId', () => {
  it('decodes iid and discussionId', () => {
    const result = decodeThreadId('42:disc-abc')
    expect(result.iid).toBe(42)
    expect(result.discussionId).toBe('disc-abc')
  })

  it('handles missing separator gracefully', () => {
    const result = decodeThreadId('no-separator')
    expect(result.iid).toBe(0)
    expect(result.discussionId).toBe('no-separator')
  })

  it('handles colons in discussion ID', () => {
    const result = decodeThreadId('42:disc:with:colons')
    expect(result.iid).toBe(42)
    expect(result.discussionId).toBe('disc:with:colons')
  })

  it('handles non-numeric iid', () => {
    const result = decodeThreadId('abc:disc')
    expect(result.iid).toBe(0)
    expect(result.discussionId).toBe('disc')
  })
})

// ---------------------------------------------------------------------------
// createGitLabProvider
// ---------------------------------------------------------------------------

describe('createGitLabProvider', () => {
  it('returns a provider with type gitlab', () => {
    const provider = createGitLabProvider(TEST_CONFIG)
    expect(provider.type).toBe('gitlab')
  })

  it('exposes correct capabilities', () => {
    const provider = createGitLabProvider(TEST_CONFIG)
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

  // -----------------------------------------------------------------------
  // Read operations (see gitlab-reads.test.ts for full read operation tests)
  // -----------------------------------------------------------------------

  describe('read operations', () => {
    it('listPRs returns items when API responds', async () => {
      const mr = {
        id: 1, iid: 1, title: 'MR', description: null,
        state: 'opened', draft: false, source_branch: 'feat', target_branch: 'main',
        author: { id: 1, username: 'u', name: 'U', avatar_url: null, web_url: 'https://gl.com/u' },
        assignees: [], reviewers: [], labels: [],
        created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
        merged_at: null, closed_at: null, merge_commit_sha: null,
        sha: 'abc', web_url: 'https://gl.com/mr/1', user_notes_count: 0,
        has_conflicts: false,
      }
      mockFetchResponse({ body: [mr] })
      const provider = createGitLabProvider(TEST_CONFIG)
      const result = await Effect.runPromise(provider.listPRs({}))
      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.number).toBe(1)
    })

    it('getPR returns a PullRequest when API responds', async () => {
      const mr = {
        id: 1, iid: 1, title: 'MR', description: null,
        state: 'opened', draft: false, source_branch: 'feat', target_branch: 'main',
        author: { id: 1, username: 'u', name: 'U', avatar_url: null, web_url: 'https://gl.com/u' },
        assignees: [], reviewers: [], labels: [],
        created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
        merged_at: null, closed_at: null, merge_commit_sha: null,
        sha: 'abc', web_url: 'https://gl.com/mr/1', user_notes_count: 0,
        has_conflicts: false,
      }
      mockFetchResponse({ body: mr })
      const provider = createGitLabProvider(TEST_CONFIG)
      const result = await Effect.runPromise(provider.getPR(1))
      expect(result.number).toBe(1)
      expect(result.title).toBe('MR')
    })

    it('getMyPRs returns PRs from created_by_me scope', async () => {
      const mr = {
        id: 1, iid: 1, title: 'My MR', description: null,
        state: 'opened', draft: false, source_branch: 'feat', target_branch: 'main',
        author: { id: 1, username: 'u', name: 'U', avatar_url: null, web_url: 'https://gl.com/u' },
        assignees: [], reviewers: [], labels: [],
        created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
        merged_at: null, closed_at: null, merge_commit_sha: null,
        sha: 'abc', web_url: 'https://gl.com/mr/1', user_notes_count: 0,
        has_conflicts: false,
      }
      mockFetchResponse({ body: [mr], headers: { 'x-next-page': '' } })
      const provider = createGitLabProvider(TEST_CONFIG)
      const result = await Effect.runPromise(provider.getMyPRs())
      expect(result).toHaveLength(1)
      const calledUrl = getLastFetchUrl()
      expect(calledUrl).toContain('scope=created_by_me')
    })
  })

  // -----------------------------------------------------------------------
  // Review mutations
  // -----------------------------------------------------------------------

  describe('submitReview', () => {
    it('approves MR for APPROVE event', async () => {
      mockFetchResponse()
      const provider = createGitLabProvider(TEST_CONFIG)
      await Effect.runPromise(provider.submitReview(42, '', 'APPROVE'))

      const url = getLastFetchUrl()
      expect(url).toContain('/approve')
    })

    it('approves MR and adds note for APPROVE with body', async () => {
      mockFetchResponse()
      const provider = createGitLabProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.submitReview(42, 'Looks great!', 'APPROVE'),
      )

      // Should have made two calls: approve + note
      const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
      expect(calls.length).toBe(2)
      expect((calls[0][0] as string)).toContain('/approve')
      expect((calls[1][0] as string)).toContain('/notes')
    })

    it('adds note for REQUEST_CHANGES event', async () => {
      mockFetchResponse()
      const provider = createGitLabProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.submitReview(42, 'Please fix this', 'REQUEST_CHANGES'),
      )

      const url = getLastFetchUrl()
      expect(url).toContain('/notes')
      const body = getLastFetchBody()
      expect(body.body).toBe('Please fix this')
    })

    it('uses default message for REQUEST_CHANGES with empty body', async () => {
      mockFetchResponse()
      const provider = createGitLabProvider(TEST_CONFIG)
      await Effect.runPromise(provider.submitReview(42, '', 'REQUEST_CHANGES'))

      const body = getLastFetchBody()
      expect(body.body).toBe('Changes requested.')
    })

    it('adds note for COMMENT event', async () => {
      mockFetchResponse()
      const provider = createGitLabProvider(TEST_CONFIG)
      await Effect.runPromise(provider.submitReview(42, 'Nice work', 'COMMENT'))

      const url = getLastFetchUrl()
      expect(url).toContain('/notes')
    })
  })

  describe('createPendingReview', () => {
    it('returns dummy id=0 since GitLab has no pending reviews', async () => {
      const provider = createGitLabProvider(TEST_CONFIG)
      const result = await Effect.runPromise(provider.createPendingReview(42))
      expect(result.id).toBe(0)
    })
  })

  describe('discardPendingReview', () => {
    it('succeeds as no-op since GitLab has no pending reviews', async () => {
      const provider = createGitLabProvider(TEST_CONFIG)
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
    it('posts note to MR', async () => {
      mockFetchResponse()
      const provider = createGitLabProvider(TEST_CONFIG)
      await Effect.runPromise(provider.addComment(42, 'Hello!'))

      const url = getLastFetchUrl()
      expect(url).toContain(`/projects/${ENCODED_PATH}/merge_requests/42/notes`)
      const body = getLastFetchBody()
      expect(body.body).toBe('Hello!')
    })
  })

  describe('addDiffComment', () => {
    it('posts diff note with position for RIGHT side', async () => {
      mockFetchResponse()
      const provider = createGitLabProvider(TEST_CONFIG)
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

      const url = getLastFetchUrl()
      expect(url).toContain('/discussions')
      const body = getLastFetchBody()
      expect(body.body).toBe('Fix this')
      const position = body.position as Record<string, unknown>
      expect(position.new_line).toBe(10)
      expect(position.old_line).toBeUndefined()
      expect(position.head_sha).toBe('abc123')
    })

    it('posts diff note with old_line for LEFT side', async () => {
      mockFetchResponse()
      const provider = createGitLabProvider(TEST_CONFIG)
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
      const position = body.position as Record<string, unknown>
      expect(position.old_line).toBe(5)
      expect(position.new_line).toBeUndefined()
    })
  })

  describe('replyToComment', () => {
    it('posts reply to discussion', async () => {
      mockFetchResponse()
      const provider = createGitLabProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.replyToComment(42, 99, 'Thanks!'),
      )

      const url = getLastFetchUrl()
      expect(url).toContain('/discussions/99/notes')
    })
  })

  // -----------------------------------------------------------------------
  // PR state mutations
  // -----------------------------------------------------------------------

  describe('mergePR', () => {
    it('sends merge request', async () => {
      mockFetchResponse()
      const provider = createGitLabProvider(TEST_CONFIG)
      await Effect.runPromise(provider.mergePR(42, 'merge'))

      const url = getLastFetchUrl()
      expect(url).toContain('/merge')
      const body = getLastFetchBody()
      expect(body.squash).toBe(false)
    })

    it('sends squash merge request', async () => {
      mockFetchResponse()
      const provider = createGitLabProvider(TEST_CONFIG)
      await Effect.runPromise(provider.mergePR(42, 'squash', 'Title'))

      const body = getLastFetchBody()
      expect(body.squash).toBe(true)
      expect(body.squash_commit_message).toBe('Title')
    })
  })

  describe('closePR', () => {
    it('sends close state event', async () => {
      mockFetchResponse()
      const provider = createGitLabProvider(TEST_CONFIG)
      await Effect.runPromise(provider.closePR(42))

      const body = getLastFetchBody()
      expect(body.state_event).toBe('close')
    })
  })

  describe('reopenPR', () => {
    it('sends reopen state event', async () => {
      mockFetchResponse()
      const provider = createGitLabProvider(TEST_CONFIG)
      await Effect.runPromise(provider.reopenPR(42))

      const body = getLastFetchBody()
      expect(body.state_event).toBe('reopen')
    })
  })

  describe('updatePRTitle', () => {
    it('updates title', async () => {
      mockFetchResponse()
      const provider = createGitLabProvider(TEST_CONFIG)
      await Effect.runPromise(provider.updatePRTitle(42, 'New Title'))

      const body = getLastFetchBody()
      expect(body.title).toBe('New Title')
    })
  })

  describe('updatePRBody', () => {
    it('updates description', async () => {
      mockFetchResponse()
      const provider = createGitLabProvider(TEST_CONFIG)
      await Effect.runPromise(provider.updatePRBody(42, 'New description'))

      const body = getLastFetchBody()
      expect(body.description).toBe('New description')
    })
  })

  describe('requestReReview', () => {
    it('sends reviewer_ids for numeric string IDs', async () => {
      mockFetchResponse()
      const provider = createGitLabProvider(TEST_CONFIG)
      await Effect.runPromise(provider.requestReReview(42, ['100', '200']))

      const body = getLastFetchBody()
      expect(body.reviewer_ids).toEqual([100, 200])
    })

    it('fails when no valid numeric IDs provided', async () => {
      const provider = createGitLabProvider(TEST_CONFIG)
      const exit = await Effect.runPromiseExit(
        provider.requestReReview(42, ['alice', 'bob']),
      )
      expect(Exit.isFailure(exit)).toBe(true)
    })

    it('filters out non-numeric IDs', async () => {
      mockFetchResponse()
      const provider = createGitLabProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.requestReReview(42, ['100', 'alice', '200']),
      )

      const body = getLastFetchBody()
      expect(body.reviewer_ids).toEqual([100, 200])
    })
  })

  // -----------------------------------------------------------------------
  // Thread operations
  // -----------------------------------------------------------------------

  describe('resolveThread', () => {
    it('resolves discussion using encoded thread ID', async () => {
      mockFetchResponse()
      const provider = createGitLabProvider(TEST_CONFIG)
      const threadId = encodeThreadId(42, 'disc-abc')
      await Effect.runPromise(provider.resolveThread(threadId))

      const url = getLastFetchUrl()
      expect(url).toContain('/discussions/disc-abc')
      const body = getLastFetchBody()
      expect(body.resolved).toBe(true)
    })
  })

  describe('unresolveThread', () => {
    it('unresolves discussion using encoded thread ID', async () => {
      mockFetchResponse()
      const provider = createGitLabProvider(TEST_CONFIG)
      const threadId = encodeThreadId(42, 'disc-abc')
      await Effect.runPromise(provider.unresolveThread(threadId))

      const body = getLastFetchBody()
      expect(body.resolved).toBe(false)
    })
  })

  // -----------------------------------------------------------------------
  // Draft operations
  // -----------------------------------------------------------------------

  describe('convertToDraft', () => {
    it('prefixes title with Draft:', async () => {
      mockFetchResponse()
      const provider = createGitLabProvider(TEST_CONFIG)
      await Effect.runPromise(provider.convertToDraft('42:My Feature'))

      const body = getLastFetchBody()
      expect(body.title).toBe('Draft: My Feature')
    })

    it('fails with invalid format', async () => {
      const provider = createGitLabProvider(TEST_CONFIG)
      const exit = await Effect.runPromiseExit(
        provider.convertToDraft('invalid'),
      )
      expect(Exit.isFailure(exit)).toBe(true)
    })

    it('fails with non-numeric iid', async () => {
      const provider = createGitLabProvider(TEST_CONFIG)
      const exit = await Effect.runPromiseExit(
        provider.convertToDraft('abc:title'),
      )
      expect(Exit.isFailure(exit)).toBe(true)
    })
  })

  describe('markReadyForReview', () => {
    it('removes Draft: prefix from title', async () => {
      mockFetchResponse()
      const provider = createGitLabProvider(TEST_CONFIG)
      await Effect.runPromise(
        provider.markReadyForReview('42:Draft: My Feature'),
      )

      const body = getLastFetchBody()
      expect(body.title).toBe('My Feature')
    })

    it('fails with invalid format', async () => {
      const provider = createGitLabProvider(TEST_CONFIG)
      const exit = await Effect.runPromiseExit(
        provider.markReadyForReview('invalid'),
      )
      expect(Exit.isFailure(exit)).toBe(true)
    })
  })

  // -----------------------------------------------------------------------
  // User info
  // -----------------------------------------------------------------------

  describe('getCurrentUser', () => {
    it('maps GitLab username to login field', async () => {
      mockFetchResponse({ body: { username: 'alice', id: 1 } })
      const provider = createGitLabProvider(TEST_CONFIG)
      const result = await Effect.runPromise(provider.getCurrentUser())

      expect(result.login).toBe('alice')
    })
  })
})

// ---------------------------------------------------------------------------
// createProvider factory integration
// ---------------------------------------------------------------------------

describe('createProvider with gitlab type', () => {
  it('creates a GitLab provider for type gitlab', () => {
    const mockService = {} as never
    const provider = createProvider(TEST_CONFIG, mockService)
    expect(provider.type).toBe('gitlab')
    expect(provider.capabilities.supportsCheckRuns).toBe(true)
  })

  it('GitLab provider has merge, squash and rebase strategies', () => {
    const mockService = {} as never
    const provider = createProvider(TEST_CONFIG, mockService)
    expect(provider.capabilities.supportsMergeStrategies).toEqual([
      'merge',
      'squash',
      'rebase',
    ])
  })
})
