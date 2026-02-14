import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect } from 'effect'
import {
  bitbucketFetch,
  bitbucketFetchJson,
  bitbucketFetchAllPages,
  mapBitbucketError,
  parseBitbucketRetryAfter,
  buildBitbucketUrl,
} from './BitbucketApiHelpers'
import { BitbucketError, NetworkError } from '../models/errors'

// Mock updateRateLimit and touchLastUpdated
vi.mock('../hooks/useRateLimit', () => ({
  updateRateLimit: vi.fn(),
}))

vi.mock('../hooks/useLastUpdated', () => ({
  touchLastUpdated: vi.fn(),
}))

const TOKEN = 'bitbucket-access-token-xxxxxxxxxxxx'
const BASE_URL = 'https://api.bitbucket.org/2.0'

function createMockResponse(
  body: unknown,
  options: {
    status?: number
    statusText?: string
    headers?: Record<string, string>
  } = {},
): Response {
  const { status = 200, statusText = 'OK', headers = {} } = options
  const responseHeaders = new Headers(headers)
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: responseHeaders,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response
}

let originalFetch: typeof globalThis.fetch

beforeEach(() => {
  originalFetch = globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// bitbucketFetch
// ---------------------------------------------------------------------------

describe('bitbucketFetch', () => {
  it('sends Authorization Bearer header for OAuth tokens', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse('OK'),
    )

    await Effect.runPromise(bitbucketFetch('/repositories', BASE_URL, TOKEN))

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${BASE_URL}/repositories`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        }),
      }),
    )
  })

  it('returns a Response on success', async () => {
    const mockResp = createMockResponse({ uuid: '{123}' })
    globalThis.fetch = vi.fn().mockResolvedValue(mockResp)

    const response = await Effect.runPromise(
      bitbucketFetch('/repositories/owner/repo', BASE_URL, TOKEN),
    )

    expect(response).toBe(mockResp)
  })

  it('returns BitbucketError on non-200 response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse(
        { error: { message: 'Repository not found' } },
        { status: 404, statusText: 'Not Found' },
      ),
    )

    const result = await Effect.runPromiseExit(
      bitbucketFetch('/repositories/owner/missing', BASE_URL, TOKEN),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      const error = (result.cause as { _tag: string; error: BitbucketError })
      expect(error.error).toBeInstanceOf(BitbucketError)
      expect(error.error.status).toBe(404)
    }
  })

  it('returns NetworkError when fetch throws', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'))

    const result = await Effect.runPromiseExit(
      bitbucketFetch('/repositories', BASE_URL, TOKEN),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      const error = (result.cause as { _tag: string; error: NetworkError })
      expect(error.error).toBeInstanceOf(NetworkError)
      expect(error.error.message).toContain('Connection refused')
    }
  })

  it('merges custom options with default headers', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse('OK'),
    )

    await Effect.runPromise(
      bitbucketFetch('/repositories', BASE_URL, TOKEN, { method: 'POST' }),
    )

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${BASE_URL}/repositories`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${TOKEN}`,
        }),
      }),
    )
  })

  it('notifies token expiration on 401 response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse(
        { error: { message: 'Unauthorized' } },
        { status: 401, statusText: 'Unauthorized' },
      ),
    )

    const result = await Effect.runPromiseExit(
      bitbucketFetch('/repositories', BASE_URL, TOKEN),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      const error = (result.cause as { _tag: string; error: BitbucketError })
      expect(error.error).toBeInstanceOf(BitbucketError)
      expect(error.error.status).toBe(401)
    }
  })
})

// ---------------------------------------------------------------------------
// bitbucketFetchJson
// ---------------------------------------------------------------------------

describe('bitbucketFetchJson', () => {
  it('fetches and parses JSON data on 200 response', async () => {
    const mockData = { uuid: '{123}', slug: 'test-repo' }
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(mockData))

    const result = await Effect.runPromise(
      bitbucketFetchJson<{ uuid: string; slug: string }>('/repositories/owner/repo', BASE_URL, TOKEN),
    )

    expect(result).toEqual({ uuid: '{123}', slug: 'test-repo' })
  })

  it('returns BitbucketError on non-200 response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse(
        { error: { message: 'Forbidden' } },
        { status: 403, statusText: 'Forbidden' },
      ),
    )

    const result = await Effect.runPromiseExit(
      bitbucketFetchJson('/repositories/owner/repo', BASE_URL, TOKEN),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      const error = (result.cause as { _tag: string; error: BitbucketError })
      expect(error.error).toBeInstanceOf(BitbucketError)
      expect(error.error.status).toBe(403)
    }
  })

  it('returns NetworkError when fetch throws', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Timeout'))

    const result = await Effect.runPromiseExit(
      bitbucketFetchJson('/repositories/owner/repo', BASE_URL, TOKEN),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      const error = (result.cause as { _tag: string; error: NetworkError })
      expect(error.error).toBeInstanceOf(NetworkError)
    }
  })

  it('passes custom options through to fetch', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse({ uuid: '{123}' }),
    )

    await Effect.runPromise(
      bitbucketFetchJson('/repositories/owner/repo', BASE_URL, TOKEN, { method: 'PUT' }),
    )

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'PUT' }),
    )
  })
})

// ---------------------------------------------------------------------------
// bitbucketFetchAllPages
// ---------------------------------------------------------------------------

describe('bitbucketFetchAllPages', () => {
  it('fetches a single page of data when no next URL', async () => {
    const body = {
      values: [{ uuid: '{1}' }, { uuid: '{2}' }],
      page: 1,
      pagelen: 100,
      size: 2,
    }
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(body))

    const result = await Effect.runPromise(
      bitbucketFetchAllPages<{ uuid: string }>('/repositories/owner/repo/pullrequests', BASE_URL, TOKEN),
    )

    expect(result).toEqual([{ uuid: '{1}' }, { uuid: '{2}' }])
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('follows next URL for multiple pages', async () => {
    const page1 = {
      values: [{ uuid: '{1}' }],
      page: 1,
      pagelen: 1,
      size: 2,
      next: 'https://api.bitbucket.org/2.0/repositories/owner/repo/pullrequests?page=2',
    }
    const page2 = {
      values: [{ uuid: '{2}' }],
      page: 2,
      pagelen: 1,
      size: 2,
    }

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(createMockResponse(page1))
      .mockResolvedValueOnce(createMockResponse(page2))

    const result = await Effect.runPromise(
      bitbucketFetchAllPages<{ uuid: string }>('/repositories/owner/repo/pullrequests', BASE_URL, TOKEN),
    )

    expect(result).toEqual([{ uuid: '{1}' }, { uuid: '{2}' }])
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('uses the exact next URL provided by Bitbucket for subsequent pages', async () => {
    const nextUrl = 'https://api.bitbucket.org/2.0/repositories/owner/repo/pullrequests?page=2&pagelen=50'
    const page1 = {
      values: [{ uuid: '{1}' }],
      page: 1,
      next: nextUrl,
    }
    const page2 = {
      values: [{ uuid: '{2}' }],
      page: 2,
    }

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(createMockResponse(page1))
      .mockResolvedValueOnce(createMockResponse(page2))

    await Effect.runPromise(
      bitbucketFetchAllPages<{ uuid: string }>('/repositories/owner/repo/pullrequests', BASE_URL, TOKEN),
    )

    // Second call should use the exact next URL from the response body
    const secondCallUrl = vi.mocked(globalThis.fetch).mock.calls[1][0] as string
    expect(secondCallUrl).toBe(nextUrl)
  })

  it('includes custom params in the first page URL', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse({ values: [], page: 1 }),
    )

    await Effect.runPromise(
      bitbucketFetchAllPages('/repositories/owner/repo/pullrequests', BASE_URL, TOKEN, {
        state: 'OPEN',
        q: 'author.uuid="{123}"',
      }),
    )

    const calledUrl = vi.mocked(globalThis.fetch).mock.calls[0][0] as string
    expect(calledUrl).toContain('state=OPEN')
    expect(calledUrl).toContain('q=')
  })

  it('sets pagelen=100 by default', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse({ values: [], page: 1 }),
    )

    await Effect.runPromise(
      bitbucketFetchAllPages('/repositories/owner/repo/pullrequests', BASE_URL, TOKEN),
    )

    const calledUrl = vi.mocked(globalThis.fetch).mock.calls[0][0] as string
    expect(calledUrl).toContain('pagelen=100')
  })

  it('returns BitbucketError when a page fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse(
        { error: { message: 'Server Error' } },
        { status: 500, statusText: 'Internal Server Error' },
      ),
    )

    const result = await Effect.runPromiseExit(
      bitbucketFetchAllPages('/repositories/owner/repo/pullrequests', BASE_URL, TOKEN),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      const error = (result.cause as { _tag: string; error: BitbucketError })
      expect(error.error).toBeInstanceOf(BitbucketError)
      expect(error.error.status).toBe(500)
    }
  })

  it('returns NetworkError when fetch throws during pagination', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    const result = await Effect.runPromiseExit(
      bitbucketFetchAllPages('/repositories/owner/repo/pullrequests', BASE_URL, TOKEN),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      const error = (result.cause as { _tag: string; error: NetworkError })
      expect(error.error).toBeInstanceOf(NetworkError)
    }
  })

  it('stops fetching after MAX_PAGES limit', async () => {
    const makePage = (page: number) =>
      createMockResponse({
        values: [{ uuid: `{${page}}` }],
        page,
        pagelen: 1,
        next: `https://api.bitbucket.org/2.0/repositories/owner/repo/pullrequests?page=${page + 1}`,
      })

    globalThis.fetch = vi.fn()
    for (let i = 1; i <= 25; i++) {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(makePage(i))
    }

    const result = await Effect.runPromise(
      bitbucketFetchAllPages<{ uuid: string }>('/repositories/owner/repo/pullrequests', BASE_URL, TOKEN),
    )

    // Should have fetched exactly 20 pages (MAX_PAGES)
    expect(globalThis.fetch).toHaveBeenCalledTimes(20)
    expect(result).toHaveLength(20)
  })

  it('handles response with empty values array', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse({ values: [], page: 1, pagelen: 100 }),
    )

    const result = await Effect.runPromise(
      bitbucketFetchAllPages<{ uuid: string }>('/repositories/owner/repo/pullrequests', BASE_URL, TOKEN),
    )

    expect(result).toEqual([])
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('handles response with missing values field gracefully', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse({ page: 1, pagelen: 100 }),
    )

    const result = await Effect.runPromise(
      bitbucketFetchAllPages<{ uuid: string }>('/repositories/owner/repo/pullrequests', BASE_URL, TOKEN),
    )

    expect(result).toEqual([])
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('returns BitbucketError when second page fails', async () => {
    const page1 = {
      values: [{ uuid: '{1}' }],
      page: 1,
      next: 'https://api.bitbucket.org/2.0/repositories/owner/repo/pullrequests?page=2',
    }

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(createMockResponse(page1))
      .mockResolvedValueOnce(
        createMockResponse(
          { error: { message: 'Rate limited' } },
          { status: 429, statusText: 'Too Many Requests' },
        ),
      )

    const result = await Effect.runPromiseExit(
      bitbucketFetchAllPages('/repositories/owner/repo/pullrequests', BASE_URL, TOKEN),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      const error = (result.cause as { _tag: string; error: BitbucketError })
      expect(error.error).toBeInstanceOf(BitbucketError)
      expect(error.error.status).toBe(429)
    }
  })
})

// ---------------------------------------------------------------------------
// mapBitbucketError
// ---------------------------------------------------------------------------

describe('mapBitbucketError', () => {
  it('maps response with nested { error: { message } } body', () => {
    const error = mapBitbucketError(
      createMockResponse('', { status: 404, statusText: 'Not Found' }),
      JSON.stringify({ error: { message: 'Repository not found' } }),
    )

    expect(error).toBeInstanceOf(BitbucketError)
    expect(error.status).toBe(404)
    expect(error.message).toBe('Resource not found')
    expect(error.detail).toContain('Repository not found')
  })

  it('maps response with { error: string } body', () => {
    const error = mapBitbucketError(
      createMockResponse('', { status: 401, statusText: 'Unauthorized' }),
      JSON.stringify({ error: 'invalid_token' }),
    )

    expect(error).toBeInstanceOf(BitbucketError)
    expect(error.status).toBe(401)
    expect(error.message).toBe('Authentication failed')
    expect(error.detail).toContain('invalid_token')
  })

  it('maps response with { error: { detail } } body', () => {
    const error = mapBitbucketError(
      createMockResponse('', { status: 400, statusText: 'Bad Request' }),
      JSON.stringify({ error: { detail: 'Invalid parameter value' } }),
    )

    expect(error).toBeInstanceOf(BitbucketError)
    expect(error.status).toBe(400)
    expect(error.detail).toContain('Invalid parameter value')
  })

  it('maps response with plain text body', () => {
    const error = mapBitbucketError(
      createMockResponse('', { status: 500, statusText: 'Internal Server Error' }),
      'Something went wrong',
    )

    expect(error).toBeInstanceOf(BitbucketError)
    expect(error.status).toBe(500)
    expect(error.detail).toBe('Something went wrong')
  })

  it('includes retryAfterMs for 429 responses', () => {
    const response = createMockResponse('', {
      status: 429,
      statusText: 'Too Many Requests',
      headers: { 'Retry-After': '60' },
    })

    const error = mapBitbucketError(response, JSON.stringify({ error: { message: 'Rate limited' } }))

    expect(error.status).toBe(429)
    expect(error.retryAfterMs).toBe(60000)
  })

  it('handles 403 status', () => {
    const error = mapBitbucketError(
      createMockResponse('', { status: 403, statusText: 'Forbidden' }),
      JSON.stringify({ error: { message: 'Insufficient privileges' } }),
    )

    expect(error.status).toBe(403)
    expect(error.message).toBe('Permission denied')
  })

  it('handles 422 status', () => {
    const error = mapBitbucketError(
      createMockResponse('', { status: 422, statusText: 'Unprocessable Entity' }),
      JSON.stringify({ error: { message: 'Validation failed' } }),
    )

    expect(error.status).toBe(422)
    expect(error.message).toBe('Validation failed')
  })

  it('handles unknown status codes', () => {
    const error = mapBitbucketError(
      createMockResponse('', { status: 418, statusText: 'I am a teapot' }),
      'teapot',
    )

    expect(error.status).toBe(418)
    expect(error.message).toBe('HTTP 418 I am a teapot')
  })

  it('maps response with { message } body (non-standard)', () => {
    const error = mapBitbucketError(
      createMockResponse('', { status: 400, statusText: 'Bad Request' }),
      JSON.stringify({ message: 'Bad request data' }),
    )

    expect(error).toBeInstanceOf(BitbucketError)
    expect(error.detail).toContain('Bad request data')
  })
})

// ---------------------------------------------------------------------------
// parseBitbucketRetryAfter
// ---------------------------------------------------------------------------

describe('parseBitbucketRetryAfter', () => {
  it('returns milliseconds from Retry-After header (seconds)', () => {
    const headers = new Headers({ 'Retry-After': '30' })

    const result = parseBitbucketRetryAfter(headers)

    expect(result).toBe(30000)
  })

  it('returns undefined when Retry-After header is not present', () => {
    const headers = new Headers()

    const result = parseBitbucketRetryAfter(headers)

    expect(result).toBeUndefined()
  })

  it('returns undefined for non-numeric Retry-After values', () => {
    const headers = new Headers({ 'Retry-After': 'invalid' })

    const result = parseBitbucketRetryAfter(headers)

    expect(result).toBeUndefined()
  })

  it('returns undefined for zero Retry-After', () => {
    const headers = new Headers({ 'Retry-After': '0' })

    const result = parseBitbucketRetryAfter(headers)

    expect(result).toBeUndefined()
  })

  it('returns undefined for negative Retry-After', () => {
    const headers = new Headers({ 'Retry-After': '-5' })

    const result = parseBitbucketRetryAfter(headers)

    expect(result).toBeUndefined()
  })

  it('handles large Retry-After values', () => {
    const headers = new Headers({ 'Retry-After': '3600' })

    const result = parseBitbucketRetryAfter(headers)

    expect(result).toBe(3600000)
  })
})

// ---------------------------------------------------------------------------
// buildBitbucketUrl
// ---------------------------------------------------------------------------

describe('buildBitbucketUrl', () => {
  it('builds URL with base path', () => {
    const url = buildBitbucketUrl(BASE_URL, '/repositories/owner/repo/pullrequests')

    expect(url).toBe('https://api.bitbucket.org/2.0/repositories/owner/repo/pullrequests')
  })

  it('builds URL with query params', () => {
    const url = buildBitbucketUrl(BASE_URL, '/repositories/owner/repo/pullrequests', {
      state: 'OPEN',
      pagelen: '50',
    })

    expect(url).toContain('state=OPEN')
    expect(url).toContain('pagelen=50')
  })

  it('handles empty params', () => {
    const url = buildBitbucketUrl(BASE_URL, '/repositories/owner/repo', {})

    expect(url).toBe('https://api.bitbucket.org/2.0/repositories/owner/repo')
  })

  it('handles self-hosted Bitbucket Server URLs', () => {
    const url = buildBitbucketUrl(
      'https://bitbucket.mycompany.com/rest/api/1.0',
      '/projects/PROJ/repos',
    )

    expect(url).toBe('https://bitbucket.mycompany.com/rest/api/1.0/projects/PROJ/repos')
  })
})

// ---------------------------------------------------------------------------
// 429 rate limit handling
// ---------------------------------------------------------------------------

describe('429 rate limit handling', () => {
  it('attaches retryAfterMs to BitbucketError for 429 responses', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse({ error: { message: 'Rate limited' } }, {
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'Retry-After': '30' },
      }),
    )

    const result = await Effect.runPromiseExit(
      bitbucketFetch('/repositories', BASE_URL, TOKEN),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      const error = (result.cause as { _tag: string; error: BitbucketError })
      expect(error.error).toBeInstanceOf(BitbucketError)
      expect(error.error.status).toBe(429)
      expect(error.error.retryAfterMs).toBe(30000)
    }
  })

  it('calls updateRateLimit with response headers', async () => {
    const { updateRateLimit } = await import('../hooks/useRateLimit')
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse({ uuid: '{1}' }, {
        headers: {
          'x-ratelimit-remaining': '99',
          'x-ratelimit-limit': '1000',
          'x-ratelimit-reset': '1700000000',
        },
      }),
    )

    await Effect.runPromise(bitbucketFetch('/repositories', BASE_URL, TOKEN))

    expect(updateRateLimit).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// bitbucketFetch with mutation methods
// ---------------------------------------------------------------------------

describe('bitbucketFetch mutation methods', () => {
  it('handles POST requests', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse({ id: 1 }),
    )

    await Effect.runPromise(
      bitbucketFetchJson('/repositories/owner/repo/pullrequests', BASE_URL, TOKEN, {
        method: 'POST',
        body: JSON.stringify({ title: 'New PR' }),
      }),
    )

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ title: 'New PR' }),
      }),
    )
  })

  it('handles PUT requests', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse({ id: 1 }),
    )

    await Effect.runPromise(
      bitbucketFetchJson('/repositories/owner/repo/pullrequests/1', BASE_URL, TOKEN, {
        method: 'PUT',
        body: JSON.stringify({ state: 'DECLINED' }),
      }),
    )

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'PUT' }),
    )
  })

  it('handles DELETE requests', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse(null, { status: 204 }),
    )

    const response = await Effect.runPromise(
      bitbucketFetch('/repositories/owner/repo/pullrequests/1/comments/1', BASE_URL, TOKEN, {
        method: 'DELETE',
      }),
    )

    expect(response.status).toBe(204)
  })
})
