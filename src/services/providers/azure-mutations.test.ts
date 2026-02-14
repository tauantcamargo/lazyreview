import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect } from 'effect'
import {
  votePR,
  createThread,
  replyToThread,
  editComment,
  deleteComment,
  updateThreadStatus,
  updatePRStatus,
  updatePRTitle,
  updatePRDescription,
  setDraftStatus,
  addReviewer,
  getCurrentUser,
  getConnectionData,
} from './azure-mutations'

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch
const BASE_URL = 'https://dev.azure.com'
const TOKEN = 'az-test-pat-token'
const OWNER = 'myorg/myproject'
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
// votePR
// ---------------------------------------------------------------------------

describe('votePR', () => {
  it('sends PUT to reviewers endpoint with vote value', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      votePR(BASE_URL, TOKEN, OWNER, REPO, 42, 'reviewer-id-123', 10),
    )

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('PUT')
    expect(url).toContain(
      '/myorg/myproject/_apis/git/repositories/myrepo/pullrequests/42/reviewers/reviewer-id-123',
    )
    expect(body).toEqual({ vote: 10 })
  })

  it('sends vote -5 for wait for author', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      votePR(BASE_URL, TOKEN, OWNER, REPO, 42, 'reviewer-id-123', -5),
    )

    const { body } = getLastFetchCall()
    expect(body).toEqual({ vote: -5 })
  })

  it('sends vote 0 to reset', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      votePR(BASE_URL, TOKEN, OWNER, REPO, 42, 'reviewer-id-123', 0),
    )

    const { body } = getLastFetchCall()
    expect(body).toEqual({ vote: 0 })
  })

  it('returns void on success', async () => {
    mockFetchResponse()
    const result = await Effect.runPromise(
      votePR(BASE_URL, TOKEN, OWNER, REPO, 42, 'reviewer-id', 10),
    )
    expect(result).toBeUndefined()
  })

  it('fails on HTTP error', async () => {
    mockFetchResponse({ ok: false, status: 403, statusText: 'Forbidden' })
    const exit = await Effect.runPromiseExit(
      votePR(BASE_URL, TOKEN, OWNER, REPO, 42, 'reviewer-id', 10),
    )
    expect(exit._tag).toBe('Failure')
  })
})

// ---------------------------------------------------------------------------
// createThread
// ---------------------------------------------------------------------------

describe('createThread', () => {
  it('sends POST to threads endpoint with comment body', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      createThread(BASE_URL, TOKEN, OWNER, REPO, 42, 'Nice work!'),
    )

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('POST')
    expect(url).toContain(
      '/myorg/myproject/_apis/git/repositories/myrepo/pullrequests/42/threads',
    )
    expect(body).toEqual({
      comments: [
        {
          parentCommentId: 0,
          content: 'Nice work!',
          commentType: 1,
        },
      ],
      status: 1,
    })
  })

  it('includes threadContext for inline comments', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      createThread(BASE_URL, TOKEN, OWNER, REPO, 42, 'Fix this', {
        filePath: '/src/index.ts',
        rightFileStart: { line: 10, offset: 1 },
        rightFileEnd: { line: 10, offset: 1 },
      }),
    )

    const { body } = getLastFetchCall()
    expect(body!.threadContext).toEqual({
      filePath: '/src/index.ts',
      rightFileStart: { line: 10, offset: 1 },
      rightFileEnd: { line: 10, offset: 1 },
    })
  })

  it('includes left side threadContext', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      createThread(BASE_URL, TOKEN, OWNER, REPO, 42, 'Old line issue', {
        filePath: '/src/old.ts',
        leftFileStart: { line: 5, offset: 1 },
        leftFileEnd: { line: 5, offset: 1 },
      }),
    )

    const { body } = getLastFetchCall()
    expect(body!.threadContext).toEqual({
      filePath: '/src/old.ts',
      leftFileStart: { line: 5, offset: 1 },
      leftFileEnd: { line: 5, offset: 1 },
    })
  })

  it('does not include threadContext when not provided', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      createThread(BASE_URL, TOKEN, OWNER, REPO, 42, 'General comment'),
    )

    const { body } = getLastFetchCall()
    expect(body!.threadContext).toBeUndefined()
  })

  it('returns void on success', async () => {
    mockFetchResponse()
    const result = await Effect.runPromise(
      createThread(BASE_URL, TOKEN, OWNER, REPO, 42, 'Comment'),
    )
    expect(result).toBeUndefined()
  })

  it('fails on HTTP error', async () => {
    mockFetchResponse({ ok: false, status: 404, statusText: 'Not Found' })
    const exit = await Effect.runPromiseExit(
      createThread(BASE_URL, TOKEN, OWNER, REPO, 42, 'Comment'),
    )
    expect(exit._tag).toBe('Failure')
  })
})

// ---------------------------------------------------------------------------
// replyToThread
// ---------------------------------------------------------------------------

describe('replyToThread', () => {
  it('sends POST to thread comments endpoint', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      replyToThread(BASE_URL, TOKEN, OWNER, REPO, 42, 100, 'Thanks!'),
    )

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('POST')
    expect(url).toContain(
      '/myorg/myproject/_apis/git/repositories/myrepo/pullrequests/42/threads/100/comments',
    )
    expect(body).toEqual({
      content: 'Thanks!',
      parentCommentId: 0,
      commentType: 1,
    })
  })

  it('returns void on success', async () => {
    mockFetchResponse()
    const result = await Effect.runPromise(
      replyToThread(BASE_URL, TOKEN, OWNER, REPO, 42, 100, 'Reply'),
    )
    expect(result).toBeUndefined()
  })

  it('fails on HTTP error', async () => {
    mockFetchResponse({ ok: false, status: 500, statusText: 'Server Error' })
    const exit = await Effect.runPromiseExit(
      replyToThread(BASE_URL, TOKEN, OWNER, REPO, 42, 100, 'Reply'),
    )
    expect(exit._tag).toBe('Failure')
  })
})

// ---------------------------------------------------------------------------
// editComment
// ---------------------------------------------------------------------------

describe('editComment', () => {
  it('sends PATCH to specific comment endpoint', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      editComment(
        BASE_URL,
        TOKEN,
        OWNER,
        REPO,
        42,
        100,
        1,
        'Updated text',
      ),
    )

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('PATCH')
    expect(url).toContain(
      '/pullrequests/42/threads/100/comments/1',
    )
    expect(body).toEqual({ content: 'Updated text' })
  })

  it('returns void on success', async () => {
    mockFetchResponse()
    const result = await Effect.runPromise(
      editComment(BASE_URL, TOKEN, OWNER, REPO, 42, 100, 1, 'Updated'),
    )
    expect(result).toBeUndefined()
  })

  it('fails on HTTP error', async () => {
    mockFetchResponse({ ok: false, status: 403, statusText: 'Forbidden' })
    const exit = await Effect.runPromiseExit(
      editComment(BASE_URL, TOKEN, OWNER, REPO, 42, 100, 1, 'Updated'),
    )
    expect(exit._tag).toBe('Failure')
  })
})

// ---------------------------------------------------------------------------
// deleteComment
// ---------------------------------------------------------------------------

describe('deleteComment', () => {
  it('sends DELETE to specific comment endpoint', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      deleteComment(BASE_URL, TOKEN, OWNER, REPO, 42, 100, 1),
    )

    const { url, method } = getLastFetchCall()
    expect(method).toBe('DELETE')
    expect(url).toContain(
      '/pullrequests/42/threads/100/comments/1',
    )
  })

  it('returns void on success', async () => {
    mockFetchResponse()
    const result = await Effect.runPromise(
      deleteComment(BASE_URL, TOKEN, OWNER, REPO, 42, 100, 1),
    )
    expect(result).toBeUndefined()
  })

  it('fails on HTTP error', async () => {
    mockFetchResponse({ ok: false, status: 404, statusText: 'Not Found' })
    const exit = await Effect.runPromiseExit(
      deleteComment(BASE_URL, TOKEN, OWNER, REPO, 42, 100, 1),
    )
    expect(exit._tag).toBe('Failure')
  })
})

// ---------------------------------------------------------------------------
// updateThreadStatus
// ---------------------------------------------------------------------------

describe('updateThreadStatus', () => {
  it('sends PATCH to thread endpoint with status', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      updateThreadStatus(BASE_URL, TOKEN, OWNER, REPO, 42, 100, 2),
    )

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('PATCH')
    expect(url).toContain(
      '/pullrequests/42/threads/100',
    )
    expect(body).toEqual({ status: 2 })
  })

  it('sets status to active (1)', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      updateThreadStatus(BASE_URL, TOKEN, OWNER, REPO, 42, 100, 1),
    )

    const { body } = getLastFetchCall()
    expect(body).toEqual({ status: 1 })
  })

  it('sets status to wontFix (3)', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      updateThreadStatus(BASE_URL, TOKEN, OWNER, REPO, 42, 100, 3),
    )

    const { body } = getLastFetchCall()
    expect(body).toEqual({ status: 3 })
  })

  it('returns void on success', async () => {
    mockFetchResponse()
    const result = await Effect.runPromise(
      updateThreadStatus(BASE_URL, TOKEN, OWNER, REPO, 42, 100, 2),
    )
    expect(result).toBeUndefined()
  })

  it('fails on HTTP error', async () => {
    mockFetchResponse({ ok: false, status: 400, statusText: 'Bad Request' })
    const exit = await Effect.runPromiseExit(
      updateThreadStatus(BASE_URL, TOKEN, OWNER, REPO, 42, 100, 2),
    )
    expect(exit._tag).toBe('Failure')
  })
})

// ---------------------------------------------------------------------------
// updatePRStatus
// ---------------------------------------------------------------------------

describe('updatePRStatus', () => {
  it('sends PATCH to pullrequest endpoint with status', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      updatePRStatus(BASE_URL, TOKEN, OWNER, REPO, 42, 'completed'),
    )

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('PATCH')
    expect(url).toContain(
      '/myorg/myproject/_apis/git/repositories/myrepo/pullrequests/42',
    )
    expect(body).toEqual({ status: 'completed' })
  })

  it('sets status to abandoned', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      updatePRStatus(BASE_URL, TOKEN, OWNER, REPO, 42, 'abandoned'),
    )

    const { body } = getLastFetchCall()
    expect(body!.status).toBe('abandoned')
  })

  it('sets status to active', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      updatePRStatus(BASE_URL, TOKEN, OWNER, REPO, 42, 'active'),
    )

    const { body } = getLastFetchCall()
    expect(body!.status).toBe('active')
  })

  it('includes completionOptions when provided', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      updatePRStatus(BASE_URL, TOKEN, OWNER, REPO, 42, 'completed', {
        mergeStrategy: 3,
        deleteSourceBranch: true,
      }),
    )

    const { body } = getLastFetchCall()
    expect(body!.completionOptions).toEqual({
      mergeStrategy: 3,
      deleteSourceBranch: true,
    })
  })

  it('does not include completionOptions when not provided', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      updatePRStatus(BASE_URL, TOKEN, OWNER, REPO, 42, 'abandoned'),
    )

    const { body } = getLastFetchCall()
    expect(body!.completionOptions).toBeUndefined()
  })

  it('includes lastMergeSourceCommit when provided', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      updatePRStatus(
        BASE_URL,
        TOKEN,
        OWNER,
        REPO,
        42,
        'completed',
        { mergeStrategy: 1 },
        'abc123',
      ),
    )

    const { body } = getLastFetchCall()
    expect(body!.lastMergeSourceCommit).toEqual({ commitId: 'abc123' })
  })

  it('returns void on success', async () => {
    mockFetchResponse()
    const result = await Effect.runPromise(
      updatePRStatus(BASE_URL, TOKEN, OWNER, REPO, 42, 'completed'),
    )
    expect(result).toBeUndefined()
  })

  it('fails on HTTP error', async () => {
    mockFetchResponse({ ok: false, status: 409, statusText: 'Conflict' })
    const exit = await Effect.runPromiseExit(
      updatePRStatus(BASE_URL, TOKEN, OWNER, REPO, 42, 'completed'),
    )
    expect(exit._tag).toBe('Failure')
  })
})

// ---------------------------------------------------------------------------
// updatePRTitle
// ---------------------------------------------------------------------------

describe('updatePRTitle', () => {
  it('sends PATCH with title field', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      updatePRTitle(BASE_URL, TOKEN, OWNER, REPO, 42, 'New Title'),
    )

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('PATCH')
    expect(url).toContain('/pullrequests/42')
    expect(body).toEqual({ title: 'New Title' })
  })

  it('returns void on success', async () => {
    mockFetchResponse()
    const result = await Effect.runPromise(
      updatePRTitle(BASE_URL, TOKEN, OWNER, REPO, 42, 'Title'),
    )
    expect(result).toBeUndefined()
  })

  it('fails on HTTP error', async () => {
    mockFetchResponse({ ok: false, status: 400, statusText: 'Bad Request' })
    const exit = await Effect.runPromiseExit(
      updatePRTitle(BASE_URL, TOKEN, OWNER, REPO, 42, 'Title'),
    )
    expect(exit._tag).toBe('Failure')
  })
})

// ---------------------------------------------------------------------------
// updatePRDescription
// ---------------------------------------------------------------------------

describe('updatePRDescription', () => {
  it('sends PATCH with description field', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      updatePRDescription(
        BASE_URL,
        TOKEN,
        OWNER,
        REPO,
        42,
        'Updated description',
      ),
    )

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('PATCH')
    expect(url).toContain('/pullrequests/42')
    expect(body).toEqual({ description: 'Updated description' })
  })

  it('returns void on success', async () => {
    mockFetchResponse()
    const result = await Effect.runPromise(
      updatePRDescription(BASE_URL, TOKEN, OWNER, REPO, 42, 'Description'),
    )
    expect(result).toBeUndefined()
  })

  it('fails on HTTP error', async () => {
    mockFetchResponse({ ok: false, status: 500, statusText: 'Server Error' })
    const exit = await Effect.runPromiseExit(
      updatePRDescription(BASE_URL, TOKEN, OWNER, REPO, 42, 'Description'),
    )
    expect(exit._tag).toBe('Failure')
  })
})

// ---------------------------------------------------------------------------
// setDraftStatus
// ---------------------------------------------------------------------------

describe('setDraftStatus', () => {
  it('sends PATCH with isDraft true', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      setDraftStatus(BASE_URL, TOKEN, OWNER, REPO, 42, true),
    )

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('PATCH')
    expect(url).toContain('/pullrequests/42')
    expect(body).toEqual({ isDraft: true })
  })

  it('sends PATCH with isDraft false', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      setDraftStatus(BASE_URL, TOKEN, OWNER, REPO, 42, false),
    )

    const { body } = getLastFetchCall()
    expect(body).toEqual({ isDraft: false })
  })

  it('returns void on success', async () => {
    mockFetchResponse()
    const result = await Effect.runPromise(
      setDraftStatus(BASE_URL, TOKEN, OWNER, REPO, 42, true),
    )
    expect(result).toBeUndefined()
  })

  it('fails on HTTP error', async () => {
    mockFetchResponse({ ok: false, status: 403, statusText: 'Forbidden' })
    const exit = await Effect.runPromiseExit(
      setDraftStatus(BASE_URL, TOKEN, OWNER, REPO, 42, true),
    )
    expect(exit._tag).toBe('Failure')
  })
})

// ---------------------------------------------------------------------------
// addReviewer
// ---------------------------------------------------------------------------

describe('addReviewer', () => {
  it('sends PUT to reviewers endpoint with vote 0', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      addReviewer(BASE_URL, TOKEN, OWNER, REPO, 42, 'user-id-456'),
    )

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('PUT')
    expect(url).toContain(
      '/pullrequests/42/reviewers/user-id-456',
    )
    expect(body).toEqual({ vote: 0 })
  })

  it('returns void on success', async () => {
    mockFetchResponse()
    const result = await Effect.runPromise(
      addReviewer(BASE_URL, TOKEN, OWNER, REPO, 42, 'user-id'),
    )
    expect(result).toBeUndefined()
  })

  it('fails on HTTP error', async () => {
    mockFetchResponse({ ok: false, status: 404, statusText: 'Not Found' })
    const exit = await Effect.runPromiseExit(
      addReviewer(BASE_URL, TOKEN, OWNER, REPO, 42, 'nonexistent'),
    )
    expect(exit._tag).toBe('Failure')
  })
})

// ---------------------------------------------------------------------------
// getCurrentUser
// ---------------------------------------------------------------------------

describe('getCurrentUser', () => {
  it('sends GET to vssps profile endpoint', async () => {
    mockFetchResponse({
      body: {
        displayName: 'Alice',
        id: 'user-id-123',
        emailAddress: 'alice@example.com',
      },
    })
    const result = await Effect.runPromise(getCurrentUser(TOKEN))

    expect(result.displayName).toBe('Alice')
    expect(result.id).toBe('user-id-123')
    expect(result.emailAddress).toBe('alice@example.com')

    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string
    expect(calledUrl).toContain('app.vssps.visualstudio.com')
    expect(calledUrl).toContain('/_apis/profile/profiles/me')
  })

  it('fails on HTTP error', async () => {
    mockFetchResponse({ ok: false, status: 401, statusText: 'Unauthorized' })
    const exit = await Effect.runPromiseExit(getCurrentUser(TOKEN))
    expect(exit._tag).toBe('Failure')
  })
})

// ---------------------------------------------------------------------------
// getConnectionData
// ---------------------------------------------------------------------------

describe('getConnectionData', () => {
  it('sends GET to connectionData endpoint', async () => {
    mockFetchResponse({
      body: {
        authenticatedUser: {
          id: 'auth-user-id',
          providerDisplayName: 'Bob',
        },
      },
    })
    const result = await Effect.runPromise(
      getConnectionData(BASE_URL, TOKEN, OWNER),
    )

    expect(result.authenticatedUser.id).toBe('auth-user-id')
    expect(result.authenticatedUser.providerDisplayName).toBe('Bob')

    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string
    expect(calledUrl).toContain('/myorg/_apis/connectionData')
  })

  it('uses org part from owner for connection data path', async () => {
    mockFetchResponse({
      body: {
        authenticatedUser: {
          id: 'id',
          providerDisplayName: 'User',
        },
      },
    })
    await Effect.runPromise(
      getConnectionData(BASE_URL, TOKEN, 'differentorg/differentproject'),
    )

    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string
    expect(calledUrl).toContain('/differentorg/_apis/connectionData')
  })

  it('fails on HTTP error', async () => {
    mockFetchResponse({ ok: false, status: 401, statusText: 'Unauthorized' })
    const exit = await Effect.runPromiseExit(
      getConnectionData(BASE_URL, TOKEN, OWNER),
    )
    expect(exit._tag).toBe('Failure')
  })
})
