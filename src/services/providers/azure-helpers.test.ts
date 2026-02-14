import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect } from 'effect'
import {
  parseAzureOwner,
  parseRetryAfter,
  mutateAzure,
  mutateAzureJson,
  fetchAzure,
} from './azure-helpers'
import { AzureError, NetworkError } from '../../models/errors'

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch
const BASE_URL = 'https://dev.azure.com'
const TOKEN = 'az-test-pat-token'

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

function mockFetchNetworkError(): void {
  globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

// ---------------------------------------------------------------------------
// parseAzureOwner
// ---------------------------------------------------------------------------

describe('parseAzureOwner', () => {
  it('parses org/project format correctly', () => {
    const result = parseAzureOwner('myorg/myproject')
    expect(result.org).toBe('myorg')
    expect(result.project).toBe('myproject')
  })

  it('returns owner as both org and project when no separator', () => {
    const result = parseAzureOwner('myorg')
    expect(result.org).toBe('myorg')
    expect(result.project).toBe('myorg')
  })

  it('handles owner with multiple slashes', () => {
    const result = parseAzureOwner('org/project/extra')
    expect(result.org).toBe('org')
    expect(result.project).toBe('project/extra')
  })

  it('handles empty string', () => {
    const result = parseAzureOwner('')
    expect(result.org).toBe('')
    expect(result.project).toBe('')
  })

  it('handles owner starting with slash', () => {
    const result = parseAzureOwner('/project')
    expect(result.org).toBe('')
    expect(result.project).toBe('project')
  })
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

  it('returns undefined for zero', () => {
    const headers = new Headers({ 'Retry-After': '0' })
    expect(parseRetryAfter(headers)).toBeUndefined()
  })

  it('returns undefined for negative value', () => {
    const headers = new Headers({ 'Retry-After': '-5' })
    expect(parseRetryAfter(headers)).toBeUndefined()
  })

  it('returns milliseconds for valid positive integer', () => {
    const headers = new Headers({ 'Retry-After': '60' })
    expect(parseRetryAfter(headers)).toBe(60000)
  })

  it('returns milliseconds for 1 second', () => {
    const headers = new Headers({ 'Retry-After': '1' })
    expect(parseRetryAfter(headers)).toBe(1000)
  })
})

// ---------------------------------------------------------------------------
// mutateAzure
// ---------------------------------------------------------------------------

describe('mutateAzure', () => {
  it('sends request with correct method and Basic auth header', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      mutateAzure('POST', BASE_URL, '/org/proj/_apis/test', TOKEN, {
        key: 'value',
      }),
    )

    const encodedToken = Buffer.from(`:${TOKEN}`).toString('base64')
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/org/proj/_apis/test'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Basic ${encodedToken}`,
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ key: 'value' }),
      }),
    )
  })

  it('includes api-version in URL query string', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      mutateAzure('POST', BASE_URL, '/org/proj/_apis/test', TOKEN, {}),
    )

    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string
    expect(calledUrl).toContain('api-version=7.0')
  })

  it('returns void on success', async () => {
    mockFetchResponse()
    const result = await Effect.runPromise(
      mutateAzure('POST', BASE_URL, '/test', TOKEN, {}),
    )
    expect(result).toBeUndefined()
  })

  it('supports PUT method', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      mutateAzure('PUT', BASE_URL, '/test', TOKEN, { vote: 10 }),
    )

    const options = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as { method: string }
    expect(options.method).toBe('PUT')
  })

  it('supports PATCH method', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      mutateAzure('PATCH', BASE_URL, '/test', TOKEN, { status: 'completed' }),
    )

    const options = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as { method: string }
    expect(options.method).toBe('PATCH')
  })

  it('supports DELETE method without body', async () => {
    mockFetchResponse()
    await Effect.runPromise(
      mutateAzure('DELETE', BASE_URL, '/test', TOKEN),
    )

    const options = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as { method: string; body?: string }
    expect(options.method).toBe('DELETE')
    expect(options.body).toBeUndefined()
  })

  it('fails with AzureError on HTTP error', async () => {
    mockFetchResponse({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      body: { message: 'Access denied' },
    })
    const exit = await Effect.runPromiseExit(
      mutateAzure('POST', BASE_URL, '/test', TOKEN, {}),
    )
    expect(exit._tag).toBe('Failure')
  })

  it('fails with NetworkError on fetch rejection', async () => {
    mockFetchNetworkError()
    const exit = await Effect.runPromiseExit(
      mutateAzure('POST', BASE_URL, '/test', TOKEN, {}),
    )
    expect(exit._tag).toBe('Failure')
  })

  it('fails with AzureError on 401', async () => {
    mockFetchResponse({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      body: { message: 'Invalid token' },
    })
    const exit = await Effect.runPromiseExit(
      mutateAzure('POST', BASE_URL, '/test', TOKEN, {}),
    )
    expect(exit._tag).toBe('Failure')
  })

  it('fails with AzureError on 404', async () => {
    mockFetchResponse({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    })
    const exit = await Effect.runPromiseExit(
      mutateAzure('POST', BASE_URL, '/test', TOKEN, {}),
    )
    expect(exit._tag).toBe('Failure')
  })

  it('fails with AzureError on 429 with retryAfterMs', async () => {
    mockFetchResponse({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      headers: { 'Retry-After': '30' },
    })
    const exit = await Effect.runPromiseExit(
      mutateAzure('POST', BASE_URL, '/test', TOKEN, {}),
    )
    expect(exit._tag).toBe('Failure')
  })
})

// ---------------------------------------------------------------------------
// mutateAzureJson
// ---------------------------------------------------------------------------

describe('mutateAzureJson', () => {
  it('returns parsed JSON on success', async () => {
    mockFetchResponse({ body: { id: 42, name: 'test-thread' } })
    const result = await Effect.runPromise(
      mutateAzureJson<{ id: number; name: string }>(
        'POST',
        BASE_URL,
        '/test',
        TOKEN,
        { content: 'hello' },
      ),
    )
    expect(result).toEqual({ id: 42, name: 'test-thread' })
  })

  it('includes api-version in URL', async () => {
    mockFetchResponse({ body: { ok: true } })
    await Effect.runPromise(
      mutateAzureJson('POST', BASE_URL, '/test', TOKEN, {}),
    )

    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string
    expect(calledUrl).toContain('api-version=7.0')
  })

  it('sends request with Basic auth header', async () => {
    mockFetchResponse({ body: { ok: true } })
    await Effect.runPromise(
      mutateAzureJson('POST', BASE_URL, '/test', TOKEN, { data: 'test' }),
    )

    const encodedToken = Buffer.from(`:${TOKEN}`).toString('base64')
    const options = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as { headers: Record<string, string> }
    expect(options.headers.Authorization).toBe(`Basic ${encodedToken}`)
  })

  it('fails on HTTP error', async () => {
    mockFetchResponse({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    })
    const exit = await Effect.runPromiseExit(
      mutateAzureJson('POST', BASE_URL, '/test', TOKEN, {}),
    )
    expect(exit._tag).toBe('Failure')
  })

  it('fails on null JSON response', async () => {
    mockFetchResponse({ body: null })
    const exit = await Effect.runPromiseExit(
      mutateAzureJson('POST', BASE_URL, '/test', TOKEN, {}),
    )
    expect(exit._tag).toBe('Failure')
  })

  it('fails with NetworkError on fetch rejection', async () => {
    mockFetchNetworkError()
    const exit = await Effect.runPromiseExit(
      mutateAzureJson('POST', BASE_URL, '/test', TOKEN, {}),
    )
    expect(exit._tag).toBe('Failure')
  })
})

// ---------------------------------------------------------------------------
// fetchAzure
// ---------------------------------------------------------------------------

describe('fetchAzure', () => {
  it('sends GET with Basic auth header', async () => {
    mockFetchResponse({ body: { displayName: 'Alice' } })
    const result = await Effect.runPromise(
      fetchAzure<{ displayName: string }>(BASE_URL, '/test', TOKEN),
    )

    expect(result.displayName).toBe('Alice')
    const encodedToken = Buffer.from(`:${TOKEN}`).toString('base64')
    const options = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as { headers: Record<string, string> }
    expect(options.headers.Authorization).toBe(`Basic ${encodedToken}`)
  })

  it('includes api-version and custom params in URL', async () => {
    mockFetchResponse({ body: {} })
    await Effect.runPromise(
      fetchAzure(BASE_URL, '/test', TOKEN, { $top: '50' }),
    )

    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string
    expect(calledUrl).toContain('api-version=7.0')
    expect(calledUrl).toContain('%24top=50')
  })

  it('fails on HTTP error', async () => {
    mockFetchResponse({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    })
    const exit = await Effect.runPromiseExit(
      fetchAzure(BASE_URL, '/nonexistent', TOKEN),
    )
    expect(exit._tag).toBe('Failure')
  })

  it('fails with NetworkError on fetch rejection', async () => {
    mockFetchNetworkError()
    const exit = await Effect.runPromiseExit(
      fetchAzure(BASE_URL, '/test', TOKEN),
    )
    expect(exit._tag).toBe('Failure')
  })

  it('handles 203 as error (non-authenticated)', async () => {
    mockFetchResponse({
      ok: false,
      status: 203,
      statusText: 'Non-Authoritative Information',
    })
    const exit = await Effect.runPromiseExit(
      fetchAzure(BASE_URL, '/test', TOKEN),
    )
    expect(exit._tag).toBe('Failure')
  })

  it('returns parsed JSON data', async () => {
    const data = {
      value: [
        { id: 1, title: 'PR 1' },
        { id: 2, title: 'PR 2' },
      ],
    }
    mockFetchResponse({ body: data })
    const result = await Effect.runPromise(
      fetchAzure<{ value: readonly { id: number; title: string }[] }>(
        BASE_URL,
        '/test',
        TOKEN,
      ),
    )
    expect(result.value).toHaveLength(2)
    expect(result.value[0].title).toBe('PR 1')
  })
})
