import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect } from 'effect'
import {
  addComment,
  addInlineComment,
  replyToReviewComment,
  editIssueComment,
  deleteIssueComment,
  submitReview,
  createPendingReview,
  mergePR,
  closePR,
  reopenPR,
  updatePRTitle,
  updatePRBody,
  requestReReview,
  getCurrentUser,
} from './gitea-mutations'

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch
const BASE_URL = 'https://gitea.example.com/api/v1'
const TOKEN = 'gitea-test-token-123'
const OWNER = 'myowner'
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
// Comments
// ---------------------------------------------------------------------------

describe('addComment', () => {
  it('sends POST to issues/{index}/comments', async () => {
    mockFetchResponse()
    await Effect.runPromise(addComment(BASE_URL, TOKEN, OWNER, REPO, 42, 'Great work!'))

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('POST')
    expect(url).toBe(`${BASE_URL}/repos/${OWNER}/${REPO}/issues/42/comments`)
    expect(body).toEqual({ body: 'Great work!' })
  })

  it('returns void on success', async () => {
    mockFetchResponse()
    const result = await Effect.runPromise(
      addComment(BASE_URL, TOKEN, OWNER, REPO, 1, 'Hello'),
    )
    expect(result).toBeUndefined()
  })

  it('fails on HTTP error', async () => {
    mockFetchResponse({ ok: false, status: 401, statusText: 'Unauthorized' })
    const exit = await Effect.runPromiseExit(
      addComment(BASE_URL, TOKEN, OWNER, REPO, 1, 'Hello'),
    )
    expect(exit._tag).toBe('Failure')
  })
})

describe('addInlineComment', () => {
  it('sends POST to pulls/{index}/reviews with review containing inline comment', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      addInlineComment(
        BASE_URL,
        TOKEN,
        OWNER,
        REPO,
        42,
        'Fix this line',
        'src/index.ts',
        15,
        'RIGHT',
      ),
    )

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('POST')
    expect(url).toBe(`${BASE_URL}/repos/${OWNER}/${REPO}/pulls/42/reviews`)
    expect(body).toEqual({
      event: 'COMMENT',
      body: '',
      comments: [
        {
          path: 'src/index.ts',
          body: 'Fix this line',
          new_position: 15,
          old_position: 0,
        },
      ],
    })
  })

  it('sets old_position for LEFT side', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      addInlineComment(
        BASE_URL,
        TOKEN,
        OWNER,
        REPO,
        42,
        'Old line issue',
        'src/foo.ts',
        20,
        'LEFT',
      ),
    )

    const { body } = getLastFetchCall()
    expect(body).toEqual({
      event: 'COMMENT',
      body: '',
      comments: [
        {
          path: 'src/foo.ts',
          body: 'Old line issue',
          new_position: 0,
          old_position: 20,
        },
      ],
    })
  })

  it('handles RIGHT side with new_position set', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      addInlineComment(
        BASE_URL,
        TOKEN,
        OWNER,
        REPO,
        1,
        'Comment',
        'file.ts',
        5,
        'RIGHT',
      ),
    )

    const { body } = getLastFetchCall()
    const comments = body!.comments as Array<Record<string, unknown>>
    expect(comments[0]!.new_position).toBe(5)
    expect(comments[0]!.old_position).toBe(0)
  })

  it('returns void on success', async () => {
    mockFetchResponse()
    const result = await Effect.runPromise(
      addInlineComment(
        BASE_URL,
        TOKEN,
        OWNER,
        REPO,
        1,
        'Comment',
        'file.ts',
        1,
        'RIGHT',
      ),
    )
    expect(result).toBeUndefined()
  })

  it('fails on HTTP error', async () => {
    mockFetchResponse({ ok: false, status: 403, statusText: 'Forbidden' })
    const exit = await Effect.runPromiseExit(
      addInlineComment(
        BASE_URL,
        TOKEN,
        OWNER,
        REPO,
        1,
        'Comment',
        'file.ts',
        1,
        'RIGHT',
      ),
    )
    expect(exit._tag).toBe('Failure')
  })
})

describe('replyToReviewComment', () => {
  it('sends POST to pulls/{index}/reviews/{id}/comments', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      replyToReviewComment(BASE_URL, TOKEN, OWNER, REPO, 42, 10, 'Thanks!'),
    )

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('POST')
    expect(url).toBe(
      `${BASE_URL}/repos/${OWNER}/${REPO}/pulls/42/reviews/10/comments`,
    )
    expect(body).toEqual({ body: 'Thanks!' })
  })

  it('returns void on success', async () => {
    mockFetchResponse()
    const result = await Effect.runPromise(
      replyToReviewComment(BASE_URL, TOKEN, OWNER, REPO, 1, 1, 'Reply'),
    )
    expect(result).toBeUndefined()
  })
})

describe('editIssueComment', () => {
  it('sends PATCH to issues/comments/{id}', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      editIssueComment(BASE_URL, TOKEN, OWNER, REPO, 99, 'Updated text'),
    )

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('PATCH')
    expect(url).toBe(
      `${BASE_URL}/repos/${OWNER}/${REPO}/issues/comments/99`,
    )
    expect(body).toEqual({ body: 'Updated text' })
  })

  it('returns void on success', async () => {
    mockFetchResponse()
    const result = await Effect.runPromise(
      editIssueComment(BASE_URL, TOKEN, OWNER, REPO, 99, 'Edit'),
    )
    expect(result).toBeUndefined()
  })

  it('fails on HTTP error', async () => {
    mockFetchResponse({ ok: false, status: 404, statusText: 'Not Found' })
    const exit = await Effect.runPromiseExit(
      editIssueComment(BASE_URL, TOKEN, OWNER, REPO, 999, 'Edit'),
    )
    expect(exit._tag).toBe('Failure')
  })
})

describe('deleteIssueComment', () => {
  it('sends DELETE to issues/comments/{id}', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      deleteIssueComment(BASE_URL, TOKEN, OWNER, REPO, 99),
    )

    const { url, method } = getLastFetchCall()
    expect(method).toBe('DELETE')
    expect(url).toBe(
      `${BASE_URL}/repos/${OWNER}/${REPO}/issues/comments/99`,
    )
  })

  it('returns void on success', async () => {
    mockFetchResponse()
    const result = await Effect.runPromise(
      deleteIssueComment(BASE_URL, TOKEN, OWNER, REPO, 99),
    )
    expect(result).toBeUndefined()
  })

  it('fails on HTTP error', async () => {
    mockFetchResponse({ ok: false, status: 404, statusText: 'Not Found' })
    const exit = await Effect.runPromiseExit(
      deleteIssueComment(BASE_URL, TOKEN, OWNER, REPO, 999),
    )
    expect(exit._tag).toBe('Failure')
  })
})

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

describe('submitReview', () => {
  it('sends POST to pulls/{index}/reviews with APPROVED event', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      submitReview(BASE_URL, TOKEN, OWNER, REPO, 42, 'LGTM', 'APPROVE'),
    )

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('POST')
    expect(url).toBe(`${BASE_URL}/repos/${OWNER}/${REPO}/pulls/42/reviews`)
    expect(body).toEqual({ body: 'LGTM', event: 'APPROVED' })
  })

  it('maps APPROVE to APPROVED', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      submitReview(BASE_URL, TOKEN, OWNER, REPO, 1, '', 'APPROVE'),
    )
    const { body } = getLastFetchCall()
    expect(body!.event).toBe('APPROVED')
  })

  it('passes REQUEST_CHANGES as-is', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      submitReview(BASE_URL, TOKEN, OWNER, REPO, 1, 'Fix', 'REQUEST_CHANGES'),
    )
    const { body } = getLastFetchCall()
    expect(body!.event).toBe('REQUEST_CHANGES')
  })

  it('passes COMMENT as-is', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      submitReview(BASE_URL, TOKEN, OWNER, REPO, 1, 'Note', 'COMMENT'),
    )
    const { body } = getLastFetchCall()
    expect(body!.event).toBe('COMMENT')
  })

  it('uses empty string for body when body is empty', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      submitReview(BASE_URL, TOKEN, OWNER, REPO, 1, '', 'APPROVE'),
    )
    const { body } = getLastFetchCall()
    expect(body!.body).toBe('')
  })

  it('returns void on success', async () => {
    mockFetchResponse()
    const result = await Effect.runPromise(
      submitReview(BASE_URL, TOKEN, OWNER, REPO, 1, '', 'APPROVE'),
    )
    expect(result).toBeUndefined()
  })

  it('fails on HTTP error', async () => {
    mockFetchResponse({ ok: false, status: 500, statusText: 'Internal Server Error' })
    const exit = await Effect.runPromiseExit(
      submitReview(BASE_URL, TOKEN, OWNER, REPO, 1, '', 'APPROVE'),
    )
    expect(exit._tag).toBe('Failure')
  })
})

describe('createPendingReview', () => {
  it('returns placeholder id=0', async () => {
    const result = await Effect.runPromise(
      createPendingReview(BASE_URL, TOKEN, OWNER, REPO, 42),
    )
    expect(result).toEqual({ id: 0 })
  })

  it('does not make any HTTP calls', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      createPendingReview(BASE_URL, TOKEN, OWNER, REPO, 42),
    )
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// PR State Mutations
// ---------------------------------------------------------------------------

describe('mergePR', () => {
  it('sends POST to pulls/{index}/merge with Do field', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      mergePR(BASE_URL, TOKEN, OWNER, REPO, 42, 'merge'),
    )

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('POST')
    expect(url).toBe(
      `${BASE_URL}/repos/${OWNER}/${REPO}/pulls/42/merge`,
    )
    expect(body!.Do).toBe('merge')
  })

  it('sends squash method', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      mergePR(BASE_URL, TOKEN, OWNER, REPO, 42, 'squash'),
    )
    const { body } = getLastFetchCall()
    expect(body!.Do).toBe('squash')
  })

  it('sends rebase method', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      mergePR(BASE_URL, TOKEN, OWNER, REPO, 42, 'rebase'),
    )
    const { body } = getLastFetchCall()
    expect(body!.Do).toBe('rebase')
  })

  it('includes merge_message_field with title only', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      mergePR(BASE_URL, TOKEN, OWNER, REPO, 42, 'squash', 'My Title'),
    )
    const { body } = getLastFetchCall()
    expect(body!.merge_message_field).toBe('My Title')
  })

  it('includes merge_message_field with title and body', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      mergePR(BASE_URL, TOKEN, OWNER, REPO, 42, 'merge', 'Title', 'Body here'),
    )
    const { body } = getLastFetchCall()
    expect(body!.merge_message_field).toBe('Title\n\nBody here')
  })

  it('omits merge_message_field when no title', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      mergePR(BASE_URL, TOKEN, OWNER, REPO, 42, 'merge'),
    )
    const { body } = getLastFetchCall()
    expect(body!.merge_message_field).toBeUndefined()
  })

  it('returns void on success', async () => {
    mockFetchResponse()
    const result = await Effect.runPromise(
      mergePR(BASE_URL, TOKEN, OWNER, REPO, 42, 'merge'),
    )
    expect(result).toBeUndefined()
  })

  it('fails on HTTP error', async () => {
    mockFetchResponse({ ok: false, status: 409, statusText: 'Conflict' })
    const exit = await Effect.runPromiseExit(
      mergePR(BASE_URL, TOKEN, OWNER, REPO, 42, 'merge'),
    )
    expect(exit._tag).toBe('Failure')
  })
})

describe('closePR', () => {
  it('sends PATCH with state: closed', async () => {
    mockFetchResponse()
    await Effect.runPromise(closePR(BASE_URL, TOKEN, OWNER, REPO, 42))

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('PATCH')
    expect(url).toBe(`${BASE_URL}/repos/${OWNER}/${REPO}/pulls/42`)
    expect(body).toEqual({ state: 'closed' })
  })

  it('returns void on success', async () => {
    mockFetchResponse()
    const result = await Effect.runPromise(
      closePR(BASE_URL, TOKEN, OWNER, REPO, 42),
    )
    expect(result).toBeUndefined()
  })

  it('fails on HTTP error', async () => {
    mockFetchResponse({ ok: false, status: 404, statusText: 'Not Found' })
    const exit = await Effect.runPromiseExit(
      closePR(BASE_URL, TOKEN, OWNER, REPO, 999),
    )
    expect(exit._tag).toBe('Failure')
  })
})

describe('reopenPR', () => {
  it('sends PATCH with state: open', async () => {
    mockFetchResponse()
    await Effect.runPromise(reopenPR(BASE_URL, TOKEN, OWNER, REPO, 42))

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('PATCH')
    expect(url).toBe(`${BASE_URL}/repos/${OWNER}/${REPO}/pulls/42`)
    expect(body).toEqual({ state: 'open' })
  })

  it('returns void on success', async () => {
    mockFetchResponse()
    const result = await Effect.runPromise(
      reopenPR(BASE_URL, TOKEN, OWNER, REPO, 42),
    )
    expect(result).toBeUndefined()
  })
})

describe('updatePRTitle', () => {
  it('sends PATCH with title field', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      updatePRTitle(BASE_URL, TOKEN, OWNER, REPO, 42, 'New Title'),
    )

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('PATCH')
    expect(url).toBe(`${BASE_URL}/repos/${OWNER}/${REPO}/pulls/42`)
    expect(body).toEqual({ title: 'New Title' })
  })

  it('returns void on success', async () => {
    mockFetchResponse()
    const result = await Effect.runPromise(
      updatePRTitle(BASE_URL, TOKEN, OWNER, REPO, 1, 'Title'),
    )
    expect(result).toBeUndefined()
  })
})

describe('updatePRBody', () => {
  it('sends PATCH with body field', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      updatePRBody(BASE_URL, TOKEN, OWNER, REPO, 42, 'Updated description'),
    )

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('PATCH')
    expect(url).toBe(`${BASE_URL}/repos/${OWNER}/${REPO}/pulls/42`)
    expect(body).toEqual({ body: 'Updated description' })
  })

  it('returns void on success', async () => {
    mockFetchResponse()
    const result = await Effect.runPromise(
      updatePRBody(BASE_URL, TOKEN, OWNER, REPO, 1, 'Body'),
    )
    expect(result).toBeUndefined()
  })
})

describe('requestReReview', () => {
  it('sends POST to pulls/{index}/requested_reviewers', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      requestReReview(BASE_URL, TOKEN, OWNER, REPO, 42, ['alice', 'bob']),
    )

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('POST')
    expect(url).toBe(
      `${BASE_URL}/repos/${OWNER}/${REPO}/pulls/42/requested_reviewers`,
    )
    expect(body).toEqual({ reviewers: ['alice', 'bob'] })
  })

  it('sends single reviewer', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      requestReReview(BASE_URL, TOKEN, OWNER, REPO, 42, ['alice']),
    )
    const { body } = getLastFetchCall()
    expect(body).toEqual({ reviewers: ['alice'] })
  })

  it('returns void on success', async () => {
    mockFetchResponse()
    const result = await Effect.runPromise(
      requestReReview(BASE_URL, TOKEN, OWNER, REPO, 42, ['alice']),
    )
    expect(result).toBeUndefined()
  })

  it('fails on HTTP error', async () => {
    mockFetchResponse({ ok: false, status: 422, statusText: 'Unprocessable Entity' })
    const exit = await Effect.runPromiseExit(
      requestReReview(BASE_URL, TOKEN, OWNER, REPO, 42, ['nonexistent']),
    )
    expect(exit._tag).toBe('Failure')
  })
})

// ---------------------------------------------------------------------------
// Current user
// ---------------------------------------------------------------------------

describe('getCurrentUser', () => {
  it('sends GET to /user endpoint with token auth', async () => {
    mockFetchResponse({
      body: { login: 'alice', id: 1 },
    })
    const result = await Effect.runPromise(
      getCurrentUser(BASE_URL, TOKEN),
    )

    expect(result.login).toBe('alice')
    expect(result.id).toBe(1)
  })

  it('calls /user endpoint', async () => {
    mockFetchResponse({
      body: { login: 'alice', id: 1 },
    })
    await Effect.runPromise(getCurrentUser(BASE_URL, TOKEN))

    const { url } = getLastFetchCall()
    expect(url).toBe(`${BASE_URL}/user`)
  })

  it('uses token authorization header', async () => {
    mockFetchResponse({
      body: { login: 'alice', id: 1 },
    })
    await Effect.runPromise(getCurrentUser(BASE_URL, TOKEN))

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `token ${TOKEN}`,
        }),
      }),
    )
  })

  it('fails on HTTP error', async () => {
    mockFetchResponse({ ok: false, status: 401, statusText: 'Unauthorized' })
    const exit = await Effect.runPromiseExit(
      getCurrentUser(BASE_URL, TOKEN),
    )
    expect(exit._tag).toBe('Failure')
  })
})
