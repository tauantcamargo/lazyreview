import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect } from 'effect'
import {
  gitlabFetch,
  gitlabFetchJson,
  gitlabFetchAllPages,
  mapGitLabError,
  parseGitLabRetryAfter,
  buildGitLabUrl,
} from './GitLabApiHelpers'
import { GitLabError, NetworkError } from '../models/errors'

// Mock updateRateLimit and touchLastUpdated
vi.mock('../hooks/useRateLimit', () => ({
  updateRateLimit: vi.fn(),
}))

vi.mock('../hooks/useLastUpdated', () => ({
  touchLastUpdated: vi.fn(),
}))

const TOKEN = 'glpat-xxxxxxxxxxxxxxxxxxxx'
const BASE_URL = 'https://gitlab.com/api/v4'

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
// gitlabFetch
// ---------------------------------------------------------------------------

describe('gitlabFetch', () => {
  it('sends PRIVATE-TOKEN header for personal access tokens', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse('OK'),
    )

    await Effect.runPromise(gitlabFetch('/projects', BASE_URL, TOKEN))

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${BASE_URL}/projects`,
      expect.objectContaining({
        headers: expect.objectContaining({
          'PRIVATE-TOKEN': TOKEN,
          'Content-Type': 'application/json',
        }),
      }),
    )
  })

  it('returns a Response on success', async () => {
    const mockResp = createMockResponse({ id: 1 })
    globalThis.fetch = vi.fn().mockResolvedValue(mockResp)

    const response = await Effect.runPromise(
      gitlabFetch('/projects/1', BASE_URL, TOKEN),
    )

    expect(response).toBe(mockResp)
  })

  it('returns GitLabError on non-200 response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse({ message: 'Not Found' }, { status: 404, statusText: 'Not Found' }),
    )

    const result = await Effect.runPromiseExit(
      gitlabFetch('/projects/999', BASE_URL, TOKEN),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      const error = (result.cause as { _tag: string; error: GitLabError })
      expect(error.error).toBeInstanceOf(GitLabError)
      expect(error.error.status).toBe(404)
    }
  })

  it('returns NetworkError when fetch throws', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'))

    const result = await Effect.runPromiseExit(
      gitlabFetch('/projects', BASE_URL, TOKEN),
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
      gitlabFetch('/projects', BASE_URL, TOKEN, { method: 'POST' }),
    )

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${BASE_URL}/projects`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'PRIVATE-TOKEN': TOKEN,
        }),
      }),
    )
  })

  it('notifies token expiration on 401 response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' }),
    )

    const result = await Effect.runPromiseExit(
      gitlabFetch('/projects', BASE_URL, TOKEN),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      const error = (result.cause as { _tag: string; error: GitLabError })
      expect(error.error).toBeInstanceOf(GitLabError)
      expect(error.error.status).toBe(401)
    }
  })
})

// ---------------------------------------------------------------------------
// gitlabFetchJson
// ---------------------------------------------------------------------------

describe('gitlabFetchJson', () => {
  it('fetches and parses JSON data on 200 response', async () => {
    const mockData = { id: 1, name: 'test-project' }
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(mockData))

    const result = await Effect.runPromise(
      gitlabFetchJson<{ id: number; name: string }>('/projects/1', BASE_URL, TOKEN),
    )

    expect(result).toEqual({ id: 1, name: 'test-project' })
  })

  it('returns GitLabError on non-200 response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' }),
    )

    const result = await Effect.runPromiseExit(
      gitlabFetchJson('/projects/1', BASE_URL, TOKEN),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      const error = (result.cause as { _tag: string; error: GitLabError })
      expect(error.error).toBeInstanceOf(GitLabError)
      expect(error.error.status).toBe(403)
    }
  })

  it('returns NetworkError when fetch throws', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Timeout'))

    const result = await Effect.runPromiseExit(
      gitlabFetchJson('/projects/1', BASE_URL, TOKEN),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      const error = (result.cause as { _tag: string; error: NetworkError })
      expect(error.error).toBeInstanceOf(NetworkError)
    }
  })

  it('passes custom options through to fetch', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse({ id: 1 }),
    )

    await Effect.runPromise(
      gitlabFetchJson('/projects/1', BASE_URL, TOKEN, { method: 'PUT' }),
    )

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'PUT' }),
    )
  })
})

// ---------------------------------------------------------------------------
// gitlabFetchAllPages
// ---------------------------------------------------------------------------

describe('gitlabFetchAllPages', () => {
  it('fetches a single page of data when no next page', async () => {
    const items = [{ id: 1 }, { id: 2 }]
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse(items, {
        headers: {
          'x-page': '1',
          'x-per-page': '20',
          'x-total': '2',
        },
      }),
    )

    const result = await Effect.runPromise(
      gitlabFetchAllPages<{ id: number }>('/projects', BASE_URL, TOKEN),
    )

    expect(result).toEqual([{ id: 1 }, { id: 2 }])
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('follows X-Next-Page header for multiple pages', async () => {
    const page1 = [{ id: 1 }]
    const page2 = [{ id: 2 }]

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(
        createMockResponse(page1, {
          headers: {
            'x-page': '1',
            'x-per-page': '20',
            'x-next-page': '2',
            'x-total': '2',
          },
        }),
      )
      .mockResolvedValueOnce(
        createMockResponse(page2, {
          headers: {
            'x-page': '2',
            'x-per-page': '20',
            'x-total': '2',
          },
        }),
      )

    const result = await Effect.runPromise(
      gitlabFetchAllPages<{ id: number }>('/projects', BASE_URL, TOKEN),
    )

    expect(result).toEqual([{ id: 1 }, { id: 2 }])
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('includes custom params in the URL', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse([], {
        headers: { 'x-page': '1', 'x-total': '0' },
      }),
    )

    await Effect.runPromise(
      gitlabFetchAllPages('/projects', BASE_URL, TOKEN, { state: 'opened', scope: 'all' }),
    )

    const calledUrl = vi.mocked(globalThis.fetch).mock.calls[0][0] as string
    expect(calledUrl).toContain('state=opened')
    expect(calledUrl).toContain('scope=all')
  })

  it('sets per_page=100 by default', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse([], {
        headers: { 'x-page': '1', 'x-total': '0' },
      }),
    )

    await Effect.runPromise(
      gitlabFetchAllPages('/projects', BASE_URL, TOKEN),
    )

    const calledUrl = vi.mocked(globalThis.fetch).mock.calls[0][0] as string
    expect(calledUrl).toContain('per_page=100')
  })

  it('returns GitLabError when a page fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse({ message: 'Server Error' }, { status: 500, statusText: 'Internal Server Error' }),
    )

    const result = await Effect.runPromiseExit(
      gitlabFetchAllPages('/projects', BASE_URL, TOKEN),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      const error = (result.cause as { _tag: string; error: GitLabError })
      expect(error.error).toBeInstanceOf(GitLabError)
      expect(error.error.status).toBe(500)
    }
  })

  it('returns NetworkError when fetch throws during pagination', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    const result = await Effect.runPromiseExit(
      gitlabFetchAllPages('/projects', BASE_URL, TOKEN),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      const error = (result.cause as { _tag: string; error: NetworkError })
      expect(error.error).toBeInstanceOf(NetworkError)
    }
  })

  it('stops fetching after MAX_PAGES limit', async () => {
    // Each page claims there is a next page, but we should stop at 20
    const makePage = (page: number) =>
      createMockResponse([{ id: page }], {
        headers: {
          'x-page': String(page),
          'x-per-page': '100',
          'x-next-page': String(page + 1),
          'x-total': '5000',
        },
      })

    globalThis.fetch = vi.fn()
    for (let i = 1; i <= 25; i++) {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(makePage(i))
    }

    const result = await Effect.runPromise(
      gitlabFetchAllPages<{ id: number }>('/projects', BASE_URL, TOKEN),
    )

    // Should have fetched exactly 20 pages (MAX_PAGES)
    expect(globalThis.fetch).toHaveBeenCalledTimes(20)
    expect(result).toHaveLength(20)
  })

  it('handles empty X-Next-Page header as no more pages', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse([{ id: 1 }], {
        headers: {
          'x-page': '1',
          'x-per-page': '20',
          'x-next-page': '',
          'x-total': '1',
        },
      }),
    )

    const result = await Effect.runPromise(
      gitlabFetchAllPages<{ id: number }>('/projects', BASE_URL, TOKEN),
    )

    expect(result).toEqual([{ id: 1 }])
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// mapGitLabError
// ---------------------------------------------------------------------------

describe('mapGitLabError', () => {
  it('maps response with { message } body', () => {
    const error = mapGitLabError(
      createMockResponse('', { status: 404, statusText: 'Not Found' }),
      JSON.stringify({ message: '404 Project Not Found' }),
    )

    expect(error).toBeInstanceOf(GitLabError)
    expect(error.status).toBe(404)
    expect(error.message).toBe('Resource not found')
    expect(error.detail).toContain('404 Project Not Found')
  })

  it('maps response with { error } body', () => {
    const error = mapGitLabError(
      createMockResponse('', { status: 401, statusText: 'Unauthorized' }),
      JSON.stringify({ error: 'invalid_token' }),
    )

    expect(error).toBeInstanceOf(GitLabError)
    expect(error.status).toBe(401)
    expect(error.message).toBe('Authentication failed')
    expect(error.detail).toContain('invalid_token')
  })

  it('maps response with plain text body', () => {
    const error = mapGitLabError(
      createMockResponse('', { status: 500, statusText: 'Internal Server Error' }),
      'Something went wrong',
    )

    expect(error).toBeInstanceOf(GitLabError)
    expect(error.status).toBe(500)
    expect(error.detail).toBe('Something went wrong')
  })

  it('includes retryAfterMs for 429 responses', () => {
    const response = createMockResponse('', {
      status: 429,
      statusText: 'Too Many Requests',
      headers: { 'Retry-After': '60' },
    })

    const error = mapGitLabError(response, JSON.stringify({ message: 'Rate limited' }))

    expect(error.status).toBe(429)
    expect(error.retryAfterMs).toBe(60000)
  })

  it('handles 403 status', () => {
    const error = mapGitLabError(
      createMockResponse('', { status: 403, statusText: 'Forbidden' }),
      JSON.stringify({ message: 'Insufficient scope' }),
    )

    expect(error.status).toBe(403)
    expect(error.message).toBe('Permission denied')
  })

  it('handles 422 status', () => {
    const error = mapGitLabError(
      createMockResponse('', { status: 422, statusText: 'Unprocessable Entity' }),
      JSON.stringify({ message: 'Validation failed' }),
    )

    expect(error.status).toBe(422)
    expect(error.message).toBe('Validation failed')
  })

  it('handles unknown status codes', () => {
    const error = mapGitLabError(
      createMockResponse('', { status: 418, statusText: 'I am a teapot' }),
      'teapot',
    )

    expect(error.status).toBe(418)
    expect(error.message).toBe('HTTP 418 I am a teapot')
  })
})

// ---------------------------------------------------------------------------
// parseGitLabRetryAfter
// ---------------------------------------------------------------------------

describe('parseGitLabRetryAfter', () => {
  it('returns milliseconds from RateLimit-Reset header (epoch seconds)', () => {
    const futureEpoch = Math.floor(Date.now() / 1000) + 60
    const headers = new Headers({ 'RateLimit-Reset': String(futureEpoch) })

    const result = parseGitLabRetryAfter(headers)

    // Should be approximately 60 seconds (allow 2 seconds tolerance)
    expect(result).toBeGreaterThan(58000)
    expect(result).toBeLessThan(62000)
  })

  it('falls back to Retry-After header (seconds)', () => {
    const headers = new Headers({ 'Retry-After': '30' })

    const result = parseGitLabRetryAfter(headers)

    expect(result).toBe(30000)
  })

  it('returns undefined when neither header is present', () => {
    const headers = new Headers()

    const result = parseGitLabRetryAfter(headers)

    expect(result).toBeUndefined()
  })

  it('returns undefined for non-numeric values', () => {
    const headers = new Headers({ 'RateLimit-Reset': 'invalid' })

    const result = parseGitLabRetryAfter(headers)

    expect(result).toBeUndefined()
  })

  it('returns minimum 1000ms when reset is in the past', () => {
    const pastEpoch = Math.floor(Date.now() / 1000) - 10
    const headers = new Headers({ 'RateLimit-Reset': String(pastEpoch) })

    const result = parseGitLabRetryAfter(headers)

    expect(result).toBe(1000)
  })
})

// ---------------------------------------------------------------------------
// buildGitLabUrl
// ---------------------------------------------------------------------------

describe('buildGitLabUrl', () => {
  it('builds URL with base path', () => {
    const url = buildGitLabUrl(BASE_URL, '/projects/1/merge_requests')

    expect(url).toBe('https://gitlab.com/api/v4/projects/1/merge_requests')
  })

  it('builds URL with query params', () => {
    const url = buildGitLabUrl(BASE_URL, '/projects/1/merge_requests', {
      state: 'opened',
      per_page: '100',
    })

    expect(url).toContain('state=opened')
    expect(url).toContain('per_page=100')
  })

  it('handles empty params', () => {
    const url = buildGitLabUrl(BASE_URL, '/projects/1', {})

    expect(url).toBe('https://gitlab.com/api/v4/projects/1')
  })

  it('handles self-hosted GitLab URLs', () => {
    const url = buildGitLabUrl(
      'https://gitlab.mycompany.com/api/v4',
      '/projects/1',
    )

    expect(url).toBe('https://gitlab.mycompany.com/api/v4/projects/1')
  })
})

// ---------------------------------------------------------------------------
// 429 rate limit handling
// ---------------------------------------------------------------------------

describe('429 rate limit handling', () => {
  it('attaches retryAfterMs to GitLabError for 429 responses', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse({ message: 'Rate limited' }, {
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'Retry-After': '30' },
      }),
    )

    const result = await Effect.runPromiseExit(
      gitlabFetch('/projects', BASE_URL, TOKEN),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      const error = (result.cause as { _tag: string; error: GitLabError })
      expect(error.error).toBeInstanceOf(GitLabError)
      expect(error.error.status).toBe(429)
      expect(error.error.retryAfterMs).toBe(30000)
    }
  })

  it('uses RateLimit-Remaining header to update rate limit store', async () => {
    const { updateRateLimit } = await import('../hooks/useRateLimit')
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse({ id: 1 }, {
        headers: {
          'ratelimit-remaining': '99',
          'ratelimit-limit': '100',
          'ratelimit-reset': '1700000000',
        },
      }),
    )

    await Effect.runPromise(gitlabFetch('/projects', BASE_URL, TOKEN))

    expect(updateRateLimit).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// gitlabFetch with mutation methods
// ---------------------------------------------------------------------------

describe('gitlabFetch mutation methods', () => {
  it('handles POST requests', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse({ id: 1 }),
    )

    await Effect.runPromise(
      gitlabFetchJson('/projects/1/merge_requests', BASE_URL, TOKEN, {
        method: 'POST',
        body: JSON.stringify({ title: 'New MR' }),
      }),
    )

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ title: 'New MR' }),
      }),
    )
  })

  it('handles PUT requests', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse({ id: 1 }),
    )

    await Effect.runPromise(
      gitlabFetchJson('/projects/1/merge_requests/1', BASE_URL, TOKEN, {
        method: 'PUT',
        body: JSON.stringify({ state_event: 'close' }),
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
      gitlabFetch('/projects/1/merge_requests/1/notes/1', BASE_URL, TOKEN, {
        method: 'DELETE',
      }),
    )

    expect(response.status).toBe(204)
  })
})
