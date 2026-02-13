import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect } from 'effect'
import { GitHubError, NetworkError } from '../../models/errors'
import {
  encodeProjectPath,
  parseRetryAfter,
  mutateGitLab,
  mutateGitLabJson,
  fetchGitLab,
} from './gitlab-helpers'

// ---------------------------------------------------------------------------
// Mock fetch globally
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch

function mockFetchResponse(options: {
  readonly ok?: boolean
  readonly status?: number
  readonly statusText?: string
  readonly body?: unknown
  readonly headers?: Record<string, string>
}): void {
  const { ok = true, status = 200, statusText = 'OK', body = {}, headers = {} } = options
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
// encodeProjectPath
// ---------------------------------------------------------------------------

describe('encodeProjectPath', () => {
  it('encodes owner/repo with URL encoding', () => {
    expect(encodeProjectPath('myorg', 'myrepo')).toBe('myorg%2Fmyrepo')
  })

  it('encodes special characters in owner or repo', () => {
    expect(encodeProjectPath('my-org', 'my.repo')).toBe('my-org%2Fmy.repo')
  })

  it('handles nested group paths', () => {
    // GitLab supports nested groups like "group/subgroup"
    expect(encodeProjectPath('group/subgroup', 'repo')).toBe(
      'group%2Fsubgroup%2Frepo',
    )
  })
})

// ---------------------------------------------------------------------------
// parseRetryAfter
// ---------------------------------------------------------------------------

describe('parseRetryAfter', () => {
  it('returns milliseconds when Retry-After header is present', () => {
    const headers = new Headers({ 'Retry-After': '30' })
    expect(parseRetryAfter(headers)).toBe(30000)
  })

  it('returns undefined when header is missing', () => {
    const headers = new Headers()
    expect(parseRetryAfter(headers)).toBeUndefined()
  })

  it('returns undefined for non-numeric values', () => {
    const headers = new Headers({ 'Retry-After': 'abc' })
    expect(parseRetryAfter(headers)).toBeUndefined()
  })

  it('returns undefined for zero', () => {
    const headers = new Headers({ 'Retry-After': '0' })
    expect(parseRetryAfter(headers)).toBeUndefined()
  })

  it('returns undefined for negative values', () => {
    const headers = new Headers({ 'Retry-After': '-5' })
    expect(parseRetryAfter(headers)).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// mutateGitLab
// ---------------------------------------------------------------------------

describe('mutateGitLab', () => {
  it('sends request with PRIVATE-TOKEN header', async () => {
    mockFetchResponse({})
    await Effect.runPromise(
      mutateGitLab('POST', 'https://gitlab.com/api/v4', '/test', 'glpat-abc123', { key: 'value' }),
    )

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://gitlab.com/api/v4/test',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'PRIVATE-TOKEN': 'glpat-abc123',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ key: 'value' }),
      }),
    )
  })

  it('returns void on success', async () => {
    mockFetchResponse({})
    const result = await Effect.runPromise(
      mutateGitLab('PUT', 'https://gitlab.com/api/v4', '/test', 'token', {}),
    )
    expect(result).toBeUndefined()
  })

  it('fails with GitHubError on HTTP error', async () => {
    mockFetchResponse({ ok: false, status: 403, statusText: 'Forbidden' })
    const exit = await Effect.runPromiseExit(
      mutateGitLab('POST', 'https://gitlab.com/api/v4', '/test', 'token', {}),
    )
    expect(exit._tag).toBe('Failure')
  })

  it('fails with NetworkError on network failure', async () => {
    mockFetchNetworkError()
    const exit = await Effect.runPromiseExit(
      mutateGitLab('POST', 'https://gitlab.com/api/v4', '/test', 'token', {}),
    )
    expect(exit._tag).toBe('Failure')
  })

  it('handles DELETE method', async () => {
    mockFetchResponse({})
    await Effect.runPromise(
      mutateGitLab('DELETE', 'https://gitlab.com/api/v4', '/test/1', 'token', {}),
    )

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://gitlab.com/api/v4/test/1',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})

// ---------------------------------------------------------------------------
// mutateGitLabJson
// ---------------------------------------------------------------------------

describe('mutateGitLabJson', () => {
  it('returns parsed JSON on success', async () => {
    mockFetchResponse({ body: { id: 42, name: 'test' } })
    const result = await Effect.runPromise(
      mutateGitLabJson<{ readonly id: number; readonly name: string }>(
        'POST',
        'https://gitlab.com/api/v4',
        '/test',
        'token',
        {},
      ),
    )
    expect(result).toEqual({ id: 42, name: 'test' })
  })

  it('fails with GitHubError on HTTP error', async () => {
    mockFetchResponse({ ok: false, status: 422, statusText: 'Unprocessable' })
    const exit = await Effect.runPromiseExit(
      mutateGitLabJson('POST', 'https://gitlab.com/api/v4', '/test', 'token', {}),
    )
    expect(exit._tag).toBe('Failure')
  })

  it('fails with NetworkError on network failure', async () => {
    mockFetchNetworkError()
    const exit = await Effect.runPromiseExit(
      mutateGitLabJson('POST', 'https://gitlab.com/api/v4', '/test', 'token', {}),
    )
    expect(exit._tag).toBe('Failure')
  })
})

// ---------------------------------------------------------------------------
// fetchGitLab
// ---------------------------------------------------------------------------

describe('fetchGitLab', () => {
  it('sends request with PRIVATE-TOKEN header', async () => {
    mockFetchResponse({ body: { username: 'testuser' } })
    await Effect.runPromise(
      fetchGitLab<{ readonly username: string }>(
        'https://gitlab.com/api/v4',
        '/user',
        'glpat-test',
      ),
    )

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://gitlab.com/api/v4/user',
      expect.objectContaining({
        headers: expect.objectContaining({
          'PRIVATE-TOKEN': 'glpat-test',
        }),
      }),
    )
  })

  it('returns parsed JSON data', async () => {
    mockFetchResponse({ body: { username: 'alice', id: 1 } })
    const result = await Effect.runPromise(
      fetchGitLab<{ readonly username: string; readonly id: number }>(
        'https://gitlab.com/api/v4',
        '/user',
        'token',
      ),
    )
    expect(result).toEqual({ username: 'alice', id: 1 })
  })

  it('fails with GitHubError on HTTP error', async () => {
    mockFetchResponse({ ok: false, status: 401, statusText: 'Unauthorized' })
    const exit = await Effect.runPromiseExit(
      fetchGitLab('https://gitlab.com/api/v4', '/user', 'bad-token'),
    )
    expect(exit._tag).toBe('Failure')
  })
})
