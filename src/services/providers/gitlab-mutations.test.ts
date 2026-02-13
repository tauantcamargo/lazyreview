import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect } from 'effect'
import {
  approveMR,
  unapproveMR,
  addNote,
  addDiffNote,
  replyToDiscussion,
  editNote,
  deleteNote,
  mergeMR,
  closeMR,
  reopenMR,
  updateMRTitle,
  updateMRBody,
  resolveDiscussion,
  unresolveDiscussion,
  convertToDraft,
  markReadyForReview,
  requestReview,
  getCurrentUser,
} from './gitlab-mutations'

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch
const BASE_URL = 'https://gitlab.com/api/v4'
const TOKEN = 'glpat-test123'
const OWNER = 'myorg'
const REPO = 'myrepo'
const ENCODED_PATH = 'myorg%2Fmyrepo'

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

// Helper to extract the URL and body from the last fetch call
function getLastFetchCall(): { url: string; method: string; body: Record<string, unknown> } {
  const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
  const lastCall = calls[calls.length - 1]
  const url = lastCall[0] as string
  const options = lastCall[1] as { method: string; body: string }
  return {
    url,
    method: options.method,
    body: JSON.parse(options.body) as Record<string, unknown>,
  }
}

// ---------------------------------------------------------------------------
// Approve / Unapprove
// ---------------------------------------------------------------------------

describe('approveMR', () => {
  it('sends POST to /projects/:id/merge_requests/:iid/approve', async () => {
    mockFetchResponse()
    await Effect.runPromise(approveMR(BASE_URL, TOKEN, OWNER, REPO, 42))

    const { url, method } = getLastFetchCall()
    expect(method).toBe('POST')
    expect(url).toBe(
      `${BASE_URL}/projects/${ENCODED_PATH}/merge_requests/42/approve`,
    )
  })

  it('returns void on success', async () => {
    mockFetchResponse()
    const result = await Effect.runPromise(
      approveMR(BASE_URL, TOKEN, OWNER, REPO, 1),
    )
    expect(result).toBeUndefined()
  })

  it('fails on HTTP error', async () => {
    mockFetchResponse({ ok: false, status: 401, statusText: 'Unauthorized' })
    const exit = await Effect.runPromiseExit(
      approveMR(BASE_URL, TOKEN, OWNER, REPO, 1),
    )
    expect(exit._tag).toBe('Failure')
  })
})

describe('unapproveMR', () => {
  it('sends POST to /projects/:id/merge_requests/:iid/unapprove', async () => {
    mockFetchResponse()
    await Effect.runPromise(unapproveMR(BASE_URL, TOKEN, OWNER, REPO, 42))

    const { url, method } = getLastFetchCall()
    expect(method).toBe('POST')
    expect(url).toBe(
      `${BASE_URL}/projects/${ENCODED_PATH}/merge_requests/42/unapprove`,
    )
  })
})

// ---------------------------------------------------------------------------
// Notes (comments)
// ---------------------------------------------------------------------------

describe('addNote', () => {
  it('sends POST with body to notes endpoint', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      addNote(BASE_URL, TOKEN, OWNER, REPO, 10, 'Great work!'),
    )

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('POST')
    expect(url).toBe(
      `${BASE_URL}/projects/${ENCODED_PATH}/merge_requests/10/notes`,
    )
    expect(body).toEqual({ body: 'Great work!' })
  })
})

describe('addDiffNote', () => {
  it('sends POST with position object to discussions endpoint', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      addDiffNote(BASE_URL, TOKEN, OWNER, REPO, 10, 'Fix this line', {
        baseSha: 'base123',
        headSha: 'head456',
        startSha: 'start789',
        newPath: 'src/index.ts',
        newLine: 15,
      }),
    )

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('POST')
    expect(url).toBe(
      `${BASE_URL}/projects/${ENCODED_PATH}/merge_requests/10/discussions`,
    )
    expect(body).toEqual({
      body: 'Fix this line',
      position: {
        position_type: 'text',
        base_sha: 'base123',
        head_sha: 'head456',
        start_sha: 'start789',
        new_path: 'src/index.ts',
        old_path: 'src/index.ts',
        new_line: 15,
      },
    })
  })

  it('includes old_line when specified', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      addDiffNote(BASE_URL, TOKEN, OWNER, REPO, 10, 'Comment on old line', {
        baseSha: 'base',
        headSha: 'head',
        startSha: 'start',
        newPath: 'src/foo.ts',
        oldLine: 20,
      }),
    )

    const { body } = getLastFetchCall()
    expect((body.position as Record<string, unknown>).old_line).toBe(20)
    expect((body.position as Record<string, unknown>).new_line).toBeUndefined()
  })

  it('includes both new_line and old_line when specified', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      addDiffNote(BASE_URL, TOKEN, OWNER, REPO, 10, 'Both lines', {
        baseSha: 'base',
        headSha: 'head',
        startSha: 'start',
        newPath: 'src/bar.ts',
        newLine: 10,
        oldLine: 8,
      }),
    )

    const { body } = getLastFetchCall()
    expect((body.position as Record<string, unknown>).new_line).toBe(10)
    expect((body.position as Record<string, unknown>).old_line).toBe(8)
  })
})

describe('replyToDiscussion', () => {
  it('sends POST to discussion notes endpoint', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      replyToDiscussion(
        BASE_URL,
        TOKEN,
        OWNER,
        REPO,
        10,
        'disc-abc',
        'Thanks for the feedback',
      ),
    )

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('POST')
    expect(url).toBe(
      `${BASE_URL}/projects/${ENCODED_PATH}/merge_requests/10/discussions/disc-abc/notes`,
    )
    expect(body).toEqual({ body: 'Thanks for the feedback' })
  })
})

describe('editNote', () => {
  it('sends PUT to note endpoint', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      editNote(BASE_URL, TOKEN, OWNER, REPO, 10, 99, 'Updated text'),
    )

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('PUT')
    expect(url).toBe(
      `${BASE_URL}/projects/${ENCODED_PATH}/merge_requests/10/notes/99`,
    )
    expect(body).toEqual({ body: 'Updated text' })
  })
})

describe('deleteNote', () => {
  it('sends DELETE to note endpoint', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      deleteNote(BASE_URL, TOKEN, OWNER, REPO, 10, 99),
    )

    const { url, method } = getLastFetchCall()
    expect(method).toBe('DELETE')
    expect(url).toBe(
      `${BASE_URL}/projects/${ENCODED_PATH}/merge_requests/10/notes/99`,
    )
  })
})

// ---------------------------------------------------------------------------
// Merge MR
// ---------------------------------------------------------------------------

describe('mergeMR', () => {
  it('sends PUT to merge endpoint for merge method', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      mergeMR(BASE_URL, TOKEN, OWNER, REPO, 42, 'merge'),
    )

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('PUT')
    expect(url).toBe(
      `${BASE_URL}/projects/${ENCODED_PATH}/merge_requests/42/merge`,
    )
    expect(body.squash).toBe(false)
  })

  it('sets squash=true for squash method', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      mergeMR(BASE_URL, TOKEN, OWNER, REPO, 42, 'squash'),
    )

    const { body } = getLastFetchCall()
    expect(body.squash).toBe(true)
  })

  it('includes squash_commit_message for squash with title', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      mergeMR(BASE_URL, TOKEN, OWNER, REPO, 42, 'squash', 'My Title', 'My Body'),
    )

    const { body } = getLastFetchCall()
    expect(body.squash).toBe(true)
    expect(body.squash_commit_message).toBe('My Title\n\nMy Body')
  })

  it('includes squash_commit_message with only title for squash', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      mergeMR(BASE_URL, TOKEN, OWNER, REPO, 42, 'squash', 'My Title'),
    )

    const { body } = getLastFetchCall()
    expect(body.squash_commit_message).toBe('My Title')
  })

  it('includes merge_commit_message for merge with title', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      mergeMR(BASE_URL, TOKEN, OWNER, REPO, 42, 'merge', 'Merge Title', 'Merge Body'),
    )

    const { body } = getLastFetchCall()
    expect(body.squash).toBe(false)
    expect(body.merge_commit_message).toBe('Merge Title\n\nMerge Body')
  })

  it('handles rebase method with squash=false', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      mergeMR(BASE_URL, TOKEN, OWNER, REPO, 42, 'rebase'),
    )

    const { body } = getLastFetchCall()
    expect(body.squash).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// MR state mutations
// ---------------------------------------------------------------------------

describe('closeMR', () => {
  it('sends PUT with state_event close', async () => {
    mockFetchResponse()
    await Effect.runPromise(closeMR(BASE_URL, TOKEN, OWNER, REPO, 42))

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('PUT')
    expect(url).toBe(
      `${BASE_URL}/projects/${ENCODED_PATH}/merge_requests/42`,
    )
    expect(body).toEqual({ state_event: 'close' })
  })
})

describe('reopenMR', () => {
  it('sends PUT with state_event reopen', async () => {
    mockFetchResponse()
    await Effect.runPromise(reopenMR(BASE_URL, TOKEN, OWNER, REPO, 42))

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('PUT')
    expect(url).toBe(
      `${BASE_URL}/projects/${ENCODED_PATH}/merge_requests/42`,
    )
    expect(body).toEqual({ state_event: 'reopen' })
  })
})

// ---------------------------------------------------------------------------
// MR metadata mutations
// ---------------------------------------------------------------------------

describe('updateMRTitle', () => {
  it('sends PUT with title field', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      updateMRTitle(BASE_URL, TOKEN, OWNER, REPO, 42, 'New Title'),
    )

    const { body } = getLastFetchCall()
    expect(body).toEqual({ title: 'New Title' })
  })
})

describe('updateMRBody', () => {
  it('sends PUT with description field', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      updateMRBody(BASE_URL, TOKEN, OWNER, REPO, 42, 'Updated description'),
    )

    const { body } = getLastFetchCall()
    expect(body).toEqual({ description: 'Updated description' })
  })
})

// ---------------------------------------------------------------------------
// Discussion resolution
// ---------------------------------------------------------------------------

describe('resolveDiscussion', () => {
  it('sends PUT with resolved=true', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      resolveDiscussion(BASE_URL, TOKEN, OWNER, REPO, 42, 'disc-xyz'),
    )

    const { url, method, body } = getLastFetchCall()
    expect(method).toBe('PUT')
    expect(url).toBe(
      `${BASE_URL}/projects/${ENCODED_PATH}/merge_requests/42/discussions/disc-xyz`,
    )
    expect(body).toEqual({ resolved: true })
  })
})

describe('unresolveDiscussion', () => {
  it('sends PUT with resolved=false', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      unresolveDiscussion(BASE_URL, TOKEN, OWNER, REPO, 42, 'disc-xyz'),
    )

    const { body } = getLastFetchCall()
    expect(body).toEqual({ resolved: false })
  })
})

// ---------------------------------------------------------------------------
// Draft operations
// ---------------------------------------------------------------------------

describe('convertToDraft', () => {
  it('prefixes title with "Draft: "', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      convertToDraft(BASE_URL, TOKEN, OWNER, REPO, 42, 'My Feature'),
    )

    const { body } = getLastFetchCall()
    expect(body).toEqual({ title: 'Draft: My Feature' })
  })

  it('does not double-prefix if already draft', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      convertToDraft(BASE_URL, TOKEN, OWNER, REPO, 42, 'Draft: My Feature'),
    )

    const { body } = getLastFetchCall()
    expect(body).toEqual({ title: 'Draft: My Feature' })
  })
})

describe('markReadyForReview', () => {
  it('removes "Draft: " prefix from title', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      markReadyForReview(BASE_URL, TOKEN, OWNER, REPO, 42, 'Draft: My Feature'),
    )

    const { body } = getLastFetchCall()
    expect(body).toEqual({ title: 'My Feature' })
  })

  it('leaves title unchanged if no draft prefix', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      markReadyForReview(BASE_URL, TOKEN, OWNER, REPO, 42, 'My Feature'),
    )

    const { body } = getLastFetchCall()
    expect(body).toEqual({ title: 'My Feature' })
  })
})

// ---------------------------------------------------------------------------
// Request review
// ---------------------------------------------------------------------------

describe('requestReview', () => {
  it('sends PUT with reviewer_ids array', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      requestReview(BASE_URL, TOKEN, OWNER, REPO, 42, [100, 200, 300]),
    )

    const { body } = getLastFetchCall()
    expect(body).toEqual({ reviewer_ids: [100, 200, 300] })
  })
})

// ---------------------------------------------------------------------------
// Current user
// ---------------------------------------------------------------------------

describe('getCurrentUser', () => {
  it('sends GET to /user endpoint', async () => {
    mockFetchResponse({ body: { username: 'alice', id: 1 } })
    const result = await Effect.runPromise(
      getCurrentUser(BASE_URL, TOKEN),
    )

    expect(result.username).toBe('alice')
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${BASE_URL}/user`,
      expect.objectContaining({
        headers: expect.objectContaining({
          'PRIVATE-TOKEN': TOKEN,
        }),
      }),
    )
  })
})
