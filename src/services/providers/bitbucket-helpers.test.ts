import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect } from 'effect'
import {
  parseRetryAfter,
  mutateBitbucket,
  mutateBitbucketJson,
  fetchBitbucket,
} from './bitbucket-helpers'

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch
const BASE_URL = 'https://api.bitbucket.org/2.0'
const TOKEN = 'bb-test-token'

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

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

// ---------------------------------------------------------------------------
// parseRetryAfter
// ---------------------------------------------------------------------------

describe('parseRetryAfter', () => {
  it('returns milliseconds from Retry-After header', () => {
    const headers = new Headers({ 'Retry-After': '30' })
    expect(parseRetryAfter(headers)).toBe(30000)
  })

  it('returns undefined when header is missing', () => {
    const headers = new Headers()
    expect(parseRetryAfter(headers)).toBeUndefined()
  })

  it('returns undefined for non-numeric value', () => {
    const headers = new Headers({ 'Retry-After': 'invalid' })
    expect(parseRetryAfter(headers)).toBeUndefined()
  })

  it('returns undefined for zero or negative', () => {
    const headers = new Headers({ 'Retry-After': '0' })
    expect(parseRetryAfter(headers)).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// mutateBitbucket
// ---------------------------------------------------------------------------

describe('mutateBitbucket', () => {
  it('sends request with correct method and Authorization header', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      mutateBitbucket('POST', BASE_URL, '/some/path', TOKEN, { key: 'value' }),
    )

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${BASE_URL}/some/path`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ key: 'value' }),
      }),
    )
  })

  it('returns void on success', async () => {
    mockFetchResponse()
    const result = await Effect.runPromise(
      mutateBitbucket('POST', BASE_URL, '/test', TOKEN, {}),
    )
    expect(result).toBeUndefined()
  })

  it('fails on HTTP error', async () => {
    mockFetchResponse({ ok: false, status: 403, statusText: 'Forbidden' })
    const exit = await Effect.runPromiseExit(
      mutateBitbucket('POST', BASE_URL, '/test', TOKEN, {}),
    )
    expect(exit._tag).toBe('Failure')
  })

  it('handles DELETE without body', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      mutateBitbucket('DELETE', BASE_URL, '/test', TOKEN),
    )

    const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
    const options = calls[0][1] as { body?: string }
    expect(options.body).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// mutateBitbucketJson
// ---------------------------------------------------------------------------

describe('mutateBitbucketJson', () => {
  it('returns parsed JSON on success', async () => {
    mockFetchResponse({ body: { id: 42, name: 'test' } })
    const result = await Effect.runPromise(
      mutateBitbucketJson<{ id: number; name: string }>(
        'POST',
        BASE_URL,
        '/test',
        TOKEN,
        { data: 'value' },
      ),
    )
    expect(result).toEqual({ id: 42, name: 'test' })
  })

  it('fails on HTTP error', async () => {
    mockFetchResponse({ ok: false, status: 500, statusText: 'Internal Server Error' })
    const exit = await Effect.runPromiseExit(
      mutateBitbucketJson('POST', BASE_URL, '/test', TOKEN, {}),
    )
    expect(exit._tag).toBe('Failure')
  })
})

// ---------------------------------------------------------------------------
// fetchBitbucket
// ---------------------------------------------------------------------------

describe('fetchBitbucket', () => {
  it('sends GET with Bearer token', async () => {
    mockFetchResponse({ body: { username: 'alice' } })
    const result = await Effect.runPromise(
      fetchBitbucket<{ username: string }>(BASE_URL, '/user', TOKEN),
    )

    expect(result.username).toBe('alice')
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${BASE_URL}/user`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${TOKEN}`,
        }),
      }),
    )
  })

  it('fails on HTTP error', async () => {
    mockFetchResponse({ ok: false, status: 404, statusText: 'Not Found' })
    const exit = await Effect.runPromiseExit(
      fetchBitbucket(BASE_URL, '/nonexistent', TOKEN),
    )
    expect(exit._tag).toBe('Failure')
  })
})
