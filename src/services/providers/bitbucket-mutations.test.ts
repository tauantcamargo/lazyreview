import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect } from 'effect'
import {
  approvePR,
  unapprovePR,
  addComment,
  addInlineComment,
  replyToComment,
  editComment,
  deleteComment,
  mergePR,
  declinePR,
  updatePRTitle,
  updatePRDescription,
  updateReviewers,
  getCurrentUser,
} from './bitbucket-mutations'

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch
const BASE_URL = 'https://api.bitbucket.org/2.0'
const TOKEN = 'bb-test-token-123'
const WORKSPACE = 'myworkspace'
const REPO = 'myrepo'

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

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

function getLastFetchCall(): {
  url: string
  method: string
  body: Record<string, unknown> | undefined
} {
  const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
  const lastCall = calls[calls.length - 1]
  const url = lastCall[0] as string
  const options = lastCall[1] as { method?: string; body?: string }
  return {
    url,
    method: options.method ?? 'GET',
    body: options.body
      ? (JSON.parse(options.body) as Record<string, unknown>)
      : undefined,
  }
}

// ---------------------------------------------------------------------------
// Approve / Unapprove
// ---------------------------------------------------------------------------

describe('approvePR', () => {
  it('sends POST to pullrequests/{id}/approve', async () => {
    mockFetchResponse()
    await Effect.runPromise(approvePR(BASE_URL, TOKEN, WORKSPACE, REPO, 42))

    const { url, method } = getLastFetchCall()
    expect(method).toBe('POST')
    expect(url).toBe(
      `${BASE_URL}/repositories/${WORKSPACE}/${REPO}/pullrequests/42/approve`,
    )
  })

  it('returns void on success', async () => {
    mockFetchResponse()
    const result = await Effect.runPromise(
      approvePR(BASE_URL, TOKEN, WORKSPACE, REPO, 1),
    )
    expect(result).toBeUndefined()
  })

  it('fails on HTTP error', async () => {
    mockFetchResponse({ ok: false, status: 401, statusText: 'Unauthorized' })
    const exit = await Effect.runPromiseExit(
      approvePR(BASE_URL, TOKEN, WORKSPACE, REPO, 1),
    )
    expect(exit._tag).toBe('Failure')
  })
})

describe('unapprovePR', () => {
  it('sends DELETE to pullrequests/{id}/approve', async () => {
    mockFetchResponse()
    await Effect.runPromise(unapprovePR(BASE_URL, TOKEN, WORKSPACE, REPO, 42))

    const { url, method } = getLastFetchCall()
    expect(method).toBe('DELETE')
    expect(url).toBe(
      `${BASE_URL}/repositories/${WORKSPACE}/${REPO}/pullrequests/42/approve`,
    )
  })
})

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

describe('addComment', () => {
  it('sends POST with content.raw to comments endpoint', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      addComment(BASE_URL, TOKEN, WORKSPACE, REPO, 10, 'Great work!'),
    )

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('POST')
    expect(url).toBe(
      `${BASE_URL}/repositories/${WORKSPACE}/${REPO}/pullrequests/10/comments`,
    )
    expect(body).toEqual({ content: { raw: 'Great work!' } })
  })
})

describe('addInlineComment', () => {
  it('sends POST with inline.to for RIGHT side', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      addInlineComment(
        BASE_URL,
        TOKEN,
        WORKSPACE,
        REPO,
        10,
        'Fix this line',
        'src/index.ts',
        15,
        'RIGHT',
      ),
    )

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('POST')
    expect(url).toBe(
      `${BASE_URL}/repositories/${WORKSPACE}/${REPO}/pullrequests/10/comments`,
    )
    expect(body).toEqual({
      content: { raw: 'Fix this line' },
      inline: { path: 'src/index.ts', to: 15 },
    })
  })

  it('sends POST with inline.from for LEFT side', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      addInlineComment(
        BASE_URL,
        TOKEN,
        WORKSPACE,
        REPO,
        10,
        'Old line comment',
        'src/foo.ts',
        20,
        'LEFT',
      ),
    )

    const { body } = getLastFetchCall()
    expect(body).toEqual({
      content: { raw: 'Old line comment' },
      inline: { path: 'src/foo.ts', from: 20 },
    })
  })
})

describe('replyToComment', () => {
  it('sends POST with parent.id to comments endpoint', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      replyToComment(BASE_URL, TOKEN, WORKSPACE, REPO, 10, 99, 'Thanks!'),
    )

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('POST')
    expect(url).toBe(
      `${BASE_URL}/repositories/${WORKSPACE}/${REPO}/pullrequests/10/comments`,
    )
    expect(body).toEqual({
      content: { raw: 'Thanks!' },
      parent: { id: 99 },
    })
  })
})

describe('editComment', () => {
  it('sends PUT with content.raw to comment endpoint', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      editComment(BASE_URL, TOKEN, WORKSPACE, REPO, 10, 99, 'Updated text'),
    )

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('PUT')
    expect(url).toBe(
      `${BASE_URL}/repositories/${WORKSPACE}/${REPO}/pullrequests/10/comments/99`,
    )
    expect(body).toEqual({ content: { raw: 'Updated text' } })
  })
})

describe('deleteComment', () => {
  it('sends DELETE to comment endpoint', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      deleteComment(BASE_URL, TOKEN, WORKSPACE, REPO, 10, 99),
    )

    const { url, method } = getLastFetchCall()
    expect(method).toBe('DELETE')
    expect(url).toBe(
      `${BASE_URL}/repositories/${WORKSPACE}/${REPO}/pullrequests/10/comments/99`,
    )
  })
})

// ---------------------------------------------------------------------------
// Merge PR
// ---------------------------------------------------------------------------

describe('mergePR', () => {
  it('sends POST with merge_commit strategy for merge method', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      mergePR(BASE_URL, TOKEN, WORKSPACE, REPO, 42, 'merge'),
    )

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('POST')
    expect(url).toBe(
      `${BASE_URL}/repositories/${WORKSPACE}/${REPO}/pullrequests/42/merge`,
    )
    expect(body!.merge_strategy).toBe('merge_commit')
  })

  it('sends squash strategy for squash method', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      mergePR(BASE_URL, TOKEN, WORKSPACE, REPO, 42, 'squash'),
    )

    const { body } = getLastFetchCall()
    expect(body!.merge_strategy).toBe('squash')
  })

  it('sends fast_forward strategy for rebase method', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      mergePR(BASE_URL, TOKEN, WORKSPACE, REPO, 42, 'rebase'),
    )

    const { body } = getLastFetchCall()
    expect(body!.merge_strategy).toBe('fast_forward')
  })

  it('includes message with title and body', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      mergePR(
        BASE_URL,
        TOKEN,
        WORKSPACE,
        REPO,
        42,
        'merge',
        'My Title',
        'My Body',
      ),
    )

    const { body } = getLastFetchCall()
    expect(body!.message).toBe('My Title\n\nMy Body')
  })

  it('includes message with only title', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      mergePR(BASE_URL, TOKEN, WORKSPACE, REPO, 42, 'squash', 'My Title'),
    )

    const { body } = getLastFetchCall()
    expect(body!.message).toBe('My Title')
  })

  it('omits message when no title provided', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      mergePR(BASE_URL, TOKEN, WORKSPACE, REPO, 42, 'merge'),
    )

    const { body } = getLastFetchCall()
    expect(body!.message).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// PR state mutations
// ---------------------------------------------------------------------------

describe('declinePR', () => {
  it('sends POST to decline endpoint', async () => {
    mockFetchResponse()
    await Effect.runPromise(declinePR(BASE_URL, TOKEN, WORKSPACE, REPO, 42))

    const { url, method } = getLastFetchCall()
    expect(method).toBe('POST')
    expect(url).toBe(
      `${BASE_URL}/repositories/${WORKSPACE}/${REPO}/pullrequests/42/decline`,
    )
  })
})

// ---------------------------------------------------------------------------
// PR metadata mutations
// ---------------------------------------------------------------------------

describe('updatePRTitle', () => {
  it('sends PUT with title field', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      updatePRTitle(BASE_URL, TOKEN, WORKSPACE, REPO, 42, 'New Title'),
    )

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('PUT')
    expect(url).toBe(
      `${BASE_URL}/repositories/${WORKSPACE}/${REPO}/pullrequests/42`,
    )
    expect(body).toEqual({ title: 'New Title' })
  })
})

describe('updatePRDescription', () => {
  it('sends PUT with description field', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      updatePRDescription(
        BASE_URL,
        TOKEN,
        WORKSPACE,
        REPO,
        42,
        'Updated description',
      ),
    )

    const { body } = getLastFetchCall()
    expect(body).toEqual({ description: 'Updated description' })
  })
})

describe('updateReviewers', () => {
  it('sends PUT with reviewers array of uuid objects', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      updateReviewers(BASE_URL, TOKEN, WORKSPACE, REPO, 42, [
        '{uuid-1}',
        '{uuid-2}',
      ]),
    )

    const { body } = getLastFetchCall()
    expect(body).toEqual({
      reviewers: [{ uuid: '{uuid-1}' }, { uuid: '{uuid-2}' }],
    })
  })
})

// ---------------------------------------------------------------------------
// Current user
// ---------------------------------------------------------------------------

describe('getCurrentUser', () => {
  it('sends GET to /user endpoint with Bearer token', async () => {
    mockFetchResponse({
      body: {
        username: 'alice',
        uuid: '{alice-uuid}',
        display_name: 'Alice',
      },
    })
    const result = await Effect.runPromise(
      getCurrentUser(BASE_URL, TOKEN),
    )

    expect(result.username).toBe('alice')
    expect(result.uuid).toBe('{alice-uuid}')
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${BASE_URL}/user`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${TOKEN}`,
        }),
      }),
    )
  })
})
