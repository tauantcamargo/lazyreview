import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect, Schema as S } from 'effect'
import {
  fetchGitHub,
  mutateGitHub,
  mutateGitHubJson,
  graphqlGitHub,
  fetchGitHubPaginated,
  fetchGitHubSearch,
  fetchGitHubSearchPaginated,
  fetchGitHubSinglePage,
  parseLinkHeader,
  buildQueryString,
  parseRetryAfter,
  getGitHubRestUrl,
  getGitHubGraphqlUrl,
  fetchTimeline,
  mapGitHubTimelineEvent,
} from './GitHubApiHelpers'
import { GitHubError, NetworkError } from '../models/errors'
import type { ListPRsOptions } from './GitHubApiTypes'

// Mock updateRateLimit and touchLastUpdated
vi.mock('../hooks/useRateLimit', () => ({
  updateRateLimit: vi.fn(),
}))

vi.mock('../hooks/useLastUpdated', () => ({
  touchLastUpdated: vi.fn(),
}))

vi.mock('../utils/sanitize', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/sanitize')>()
  return {
    ...actual,
    sanitizeApiError: actual.sanitizeApiError,
  }
})

const TOKEN = 'ghp_testtoken123456'

function createMockResponse(
  body: unknown,
  options: { status?: number; statusText?: string; headers?: Record<string, string> } = {},
): Response {
  const { status = 200, statusText = 'OK', headers = {} } = options
  const responseHeaders = new Headers(headers)
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: responseHeaders,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response
}

function makePR(num: number) {
  return {
    id: num,
    number: num,
    title: `PR #${num}`,
    body: null,
    state: 'open',
    draft: false,
    merged: false,
    user: {
      login: 'testuser',
      id: 1,
      avatar_url: 'https://example.com/avatar.png',
      html_url: 'https://github.com/testuser',
      type: 'User',
    },
    labels: [],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    merged_at: null,
    closed_at: null,
    html_url: `https://github.com/owner/repo/pull/${num}`,
    head: { ref: 'feature', sha: 'abc123', label: 'owner:feature' },
    base: { ref: 'main', sha: 'def456', label: 'owner:main' },
    additions: 10,
    deletions: 5,
    changed_files: 3,
    comments: 0,
    review_comments: 0,
    requested_reviewers: [],
    assignees: [],
    mergeable: null,
    mergeable_state: null,
    merge_commit_sha: null,
  }
}

// Simple schema for testing
const SimpleSchema = S.Struct({
  id: S.Number,
  name: S.String,
})

let originalFetch: typeof globalThis.fetch

beforeEach(() => {
  originalFetch = globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('fetchGitHub', () => {
  it('fetches and decodes data on 200 response', async () => {
    const mockData = { id: 1, name: 'test' }
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(mockData))

    const result = await Effect.runPromise(
      fetchGitHub('/test/path', TOKEN, SimpleSchema),
    )

    expect(result).toEqual({ id: 1, name: 'test' })
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.github.com/test/path',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${TOKEN}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        }),
      }),
    )
  })

  it('returns GitHubError on non-200 response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse('Not Found', { status: 404, statusText: 'Not Found' }),
    )

    const result = await Effect.runPromiseExit(
      fetchGitHub('/missing', TOKEN, SimpleSchema),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      const error = (result.cause as { _tag: string; error: GitHubError })
      expect(error.error).toBeInstanceOf(GitHubError)
      expect(error.error.status).toBe(404)
    }
  })

  it('returns NetworkError when fetch throws', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'))

    const result = await Effect.runPromiseExit(
      fetchGitHub('/test', TOKEN, SimpleSchema),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      const error = (result.cause as { _tag: string; error: NetworkError })
      expect(error.error).toBeInstanceOf(NetworkError)
      expect(error.error.message).toContain('Connection refused')
    }
  })

  it('returns GitHubError for schema decode failure', async () => {
    // Return data that doesn't match the schema
    const mockData = { id: 'not-a-number', name: 123 }
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(mockData))

    const result = await Effect.runPromiseExit(
      fetchGitHub('/test', TOKEN, SimpleSchema),
    )

    // Schema decode throws synchronously, caught by tryPromise's catch
    expect(result._tag).toBe('Failure')
  })
})

describe('mutateGitHub', () => {
  it('succeeds on 200 POST response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse({}, { status: 200 }),
    )

    await Effect.runPromise(
      mutateGitHub('POST', '/test', TOKEN, { key: 'value' }),
    )

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.github.com/test',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ key: 'value' }),
      }),
    )
  })

  it('succeeds on 204 PUT response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse(null, { status: 204, statusText: 'No Content' }),
    )

    await Effect.runPromise(
      mutateGitHub('PUT', '/test', TOKEN, { data: 'test' }),
    )

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'PUT' }),
    )
  })

  it('returns GitHubError on 403 response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse('Forbidden', { status: 403, statusText: 'Forbidden' }),
    )

    const result = await Effect.runPromiseExit(
      mutateGitHub('PATCH', '/test', TOKEN, {}),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      const error = (result.cause as { _tag: string; error: GitHubError })
      expect(error.error).toBeInstanceOf(GitHubError)
      expect(error.error.status).toBe(403)
    }
  })

  it('returns NetworkError when fetch throws', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Timeout'))

    const result = await Effect.runPromiseExit(
      mutateGitHub('DELETE', '/test', TOKEN, {}),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      const error = (result.cause as { _tag: string; error: NetworkError })
      expect(error.error).toBeInstanceOf(NetworkError)
    }
  })

  it('handles PATCH method correctly', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse({}, { status: 200 }),
    )

    await Effect.runPromise(
      mutateGitHub('PATCH', '/repos/owner/repo/pulls/1', TOKEN, { title: 'New title' }),
    )

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/pulls/1',
      expect.objectContaining({ method: 'PATCH' }),
    )
  })

  it('handles DELETE method correctly', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse(null, { status: 204 }),
    )

    await Effect.runPromise(
      mutateGitHub('DELETE', '/repos/owner/repo/comments/1', TOKEN, {}),
    )

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/comments/1',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})

describe('mutateGitHubJson', () => {
  it('returns parsed JSON on success', async () => {
    const responseData = { id: 42, node_id: 'abc' }
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(responseData))

    const result = await Effect.runPromise(
      mutateGitHubJson<{ id: number; node_id: string }>('POST', '/test', TOKEN, { body: 'test' }),
    )

    expect(result).toEqual({ id: 42, node_id: 'abc' })
  })

  it('returns GitHubError on non-200 response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse('Error', { status: 422, statusText: 'Unprocessable' }),
    )

    const result = await Effect.runPromiseExit(
      mutateGitHubJson('POST', '/test', TOKEN, {}),
    )

    expect(result._tag).toBe('Failure')
  })

  it('returns GitHubError when response is null', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse(null, { status: 200 }),
    )

    const result = await Effect.runPromiseExit(
      mutateGitHubJson('POST', '/test', TOKEN, {}),
    )

    expect(result._tag).toBe('Failure')
  })
})

describe('graphqlGitHub', () => {
  it('returns data on success', async () => {
    const graphqlResponse = {
      data: {
        repository: { pullRequest: { id: 'PR_1' } },
      },
    }
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(graphqlResponse))

    const result = await Effect.runPromise(
      graphqlGitHub<{ repository: { pullRequest: { id: string } } }>(
        TOKEN,
        'query { repository { pullRequest { id } } }',
        {},
      ),
    )

    expect(result.repository.pullRequest.id).toBe('PR_1')
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.github.com/graphql',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('query'),
      }),
    )
  })

  it('returns GitHubError when GraphQL response has errors', async () => {
    const graphqlResponse = {
      errors: [{ message: 'Not found' }],
    }
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(graphqlResponse))

    const result = await Effect.runPromiseExit(
      graphqlGitHub(TOKEN, 'query { bad }', {}),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      const error = (result.cause as { _tag: string; error: GitHubError })
      expect(error.error).toBeInstanceOf(GitHubError)
      expect(error.error.message).toContain('GraphQL request returned errors')
    }
  })

  it('returns GitHubError on non-200 HTTP response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse('Unauthorized', { status: 401, statusText: 'Unauthorized' }),
    )

    const result = await Effect.runPromiseExit(
      graphqlGitHub(TOKEN, 'query { test }', {}),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      const error = (result.cause as { _tag: string; error: GitHubError })
      expect(error.error).toBeInstanceOf(GitHubError)
      expect(error.error.status).toBe(401)
    }
  })

  it('returns NetworkError when fetch throws', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('DNS failure'))

    const result = await Effect.runPromiseExit(
      graphqlGitHub(TOKEN, 'query { test }', {}),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      const error = (result.cause as { _tag: string; error: NetworkError })
      expect(error.error).toBeInstanceOf(NetworkError)
    }
  })

  it('returns GitHubError when data field is missing', async () => {
    const graphqlResponse = { data: null }
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(graphqlResponse))

    const result = await Effect.runPromiseExit(
      graphqlGitHub(TOKEN, 'query { test }', {}),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      const error = (result.cause as { _tag: string; error: GitHubError })
      expect(error.error).toBeInstanceOf(GitHubError)
      expect(error.error.message).toContain('missing data field')
    }
  })

  it('passes variables in request body', async () => {
    const graphqlResponse = { data: { viewer: { login: 'user' } } }
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(graphqlResponse))

    await Effect.runPromise(
      graphqlGitHub(TOKEN, 'query($owner: String!) { repo(owner: $owner) { name } }', { owner: 'testowner' }),
    )

    const call = vi.mocked(globalThis.fetch).mock.calls[0]
    const body = JSON.parse(call[1]?.body as string)
    expect(body.variables).toEqual({ owner: 'testowner' })
  })
})

describe('fetchGitHubPaginated', () => {
  it('fetches single page of data', async () => {
    const items = [{ id: 1, name: 'item1' }, { id: 2, name: 'item2' }]
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse(items),
    )

    const result = await Effect.runPromise(
      fetchGitHubPaginated('/test', TOKEN, SimpleSchema),
    )

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ id: 1, name: 'item1' })
  })

  it('follows Link header for multiple pages', async () => {
    const page1 = [{ id: 1, name: 'item1' }]
    const page2 = [{ id: 2, name: 'item2' }]

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(
        createMockResponse(page1, {
          headers: {
            Link: '<https://api.github.com/test?page=2&per_page=100>; rel="next"',
          },
        }),
      )
      .mockResolvedValueOnce(createMockResponse(page2))

    const result = await Effect.runPromise(
      fetchGitHubPaginated('/test', TOKEN, SimpleSchema),
    )

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ id: 1, name: 'item1' })
    expect(result[1]).toEqual({ id: 2, name: 'item2' })
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('adds per_page=100 if not already present', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse([]))

    await Effect.runPromise(
      fetchGitHubPaginated('/test', TOKEN, SimpleSchema),
    )

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('per_page=100'),
      expect.any(Object),
    )
  })

  it('does not duplicate per_page if already present', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse([]))

    await Effect.runPromise(
      fetchGitHubPaginated('/test?per_page=50', TOKEN, SimpleSchema),
    )

    const calledUrl = vi.mocked(globalThis.fetch).mock.calls[0][0] as string
    expect(calledUrl).not.toContain('per_page=100')
    expect(calledUrl).toContain('per_page=50')
  })

  it('returns GitHubError when a page fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse('Server Error', { status: 500, statusText: 'Internal Server Error' }),
    )

    const result = await Effect.runPromiseExit(
      fetchGitHubPaginated('/test', TOKEN, SimpleSchema),
    )

    expect(result._tag).toBe('Failure')
  })

  it('returns NetworkError when fetch throws during pagination', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    const result = await Effect.runPromiseExit(
      fetchGitHubPaginated('/test', TOKEN, SimpleSchema),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      const error = (result.cause as { _tag: string; error: NetworkError })
      expect(error.error).toBeInstanceOf(NetworkError)
    }
  })
})

describe('fetchGitHubSearch', () => {
  it('fetches and returns items from search results', async () => {
    const pr = makePR(1)
    const searchResponse = {
      total_count: 1,
      incomplete_results: false,
      items: [pr],
    }
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(searchResponse))

    const result = await Effect.runPromise(
      fetchGitHubSearch('is:pr author:testuser', TOKEN),
    )

    expect(result).toHaveLength(1)
    expect(result[0].number).toBe(1)
  })

  it('returns GitHubError on non-200 response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse('', { status: 422, statusText: 'Unprocessable' }),
    )

    const result = await Effect.runPromiseExit(
      fetchGitHubSearch('invalid query', TOKEN),
    )

    expect(result._tag).toBe('Failure')
  })

  it('encodes query in URL', async () => {
    const searchResponse = {
      total_count: 0,
      incomplete_results: false,
      items: [],
    }
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(searchResponse))

    await Effect.runPromise(
      fetchGitHubSearch('is:pr is:open author:user', TOKEN),
    )

    const calledUrl = vi.mocked(globalThis.fetch).mock.calls[0][0] as string
    expect(calledUrl).toContain(encodeURIComponent('is:pr is:open author:user'))
  })
})

describe('fetchGitHubSearchPaginated', () => {
  it('fetches multiple pages of search results', async () => {
    const pr1 = makePR(1)
    const pr2 = makePR(2)

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(
        createMockResponse(
          { total_count: 2, incomplete_results: false, items: [pr1] },
          {
            headers: {
              Link: '<https://api.github.com/search/issues?q=test&page=2>; rel="next"',
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        createMockResponse(
          { total_count: 2, incomplete_results: false, items: [pr2] },
        ),
      )

    const result = await Effect.runPromise(
      fetchGitHubSearchPaginated('test', TOKEN),
    )

    expect(result).toHaveLength(2)
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('returns GitHubError on failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse('', { status: 403, statusText: 'Forbidden' }),
    )

    const result = await Effect.runPromiseExit(
      fetchGitHubSearchPaginated('test', TOKEN),
    )

    expect(result._tag).toBe('Failure')
  })
})

describe('parseLinkHeader', () => {
  it('returns null when header is null', () => {
    expect(parseLinkHeader(null)).toBeNull()
  })

  it('returns null when header is empty string', () => {
    expect(parseLinkHeader('')).toBeNull()
  })

  it('extracts next URL from Link header', () => {
    const header =
      '<https://api.github.com/repos/owner/repo/pulls?page=2>; rel="next", <https://api.github.com/repos/owner/repo/pulls?page=5>; rel="last"'
    expect(parseLinkHeader(header)).toBe(
      'https://api.github.com/repos/owner/repo/pulls?page=2',
    )
  })

  it('returns null when no next link exists', () => {
    const header =
      '<https://api.github.com/repos/owner/repo/pulls?page=1>; rel="prev", <https://api.github.com/repos/owner/repo/pulls?page=5>; rel="last"'
    expect(parseLinkHeader(header)).toBeNull()
  })

  it('handles header with only next link', () => {
    const header =
      '<https://api.github.com/repos/owner/repo/pulls?page=3>; rel="next"'
    expect(parseLinkHeader(header)).toBe(
      'https://api.github.com/repos/owner/repo/pulls?page=3',
    )
  })

  it('handles header with multiple parameters in URL', () => {
    const header =
      '<https://api.github.com/repos/owner/repo/pulls?state=open&per_page=100&page=2>; rel="next"'
    expect(parseLinkHeader(header)).toBe(
      'https://api.github.com/repos/owner/repo/pulls?state=open&per_page=100&page=2',
    )
  })

  it('handles header with extra whitespace', () => {
    const header =
      '<https://api.github.com/repos/owner/repo/pulls?page=2>;  rel="next" , <https://api.github.com/repos/owner/repo/pulls?page=5>; rel="last"'
    expect(parseLinkHeader(header)).toBe(
      'https://api.github.com/repos/owner/repo/pulls?page=2',
    )
  })

  it('handles header with prev, next, first, and last links', () => {
    const header = [
      '<https://api.github.com/repos/owner/repo/pulls?page=1>; rel="prev"',
      '<https://api.github.com/repos/owner/repo/pulls?page=3>; rel="next"',
      '<https://api.github.com/repos/owner/repo/pulls?page=1>; rel="first"',
      '<https://api.github.com/repos/owner/repo/pulls?page=10>; rel="last"',
    ].join(', ')
    expect(parseLinkHeader(header)).toBe(
      'https://api.github.com/repos/owner/repo/pulls?page=3',
    )
  })

  it('returns null for malformed link header', () => {
    expect(parseLinkHeader('not a valid link header')).toBeNull()
  })

  it('returns null when only rel="prev" present', () => {
    const header =
      '<https://api.github.com/repos/owner/repo/pulls?page=1>; rel="prev"'
    expect(parseLinkHeader(header)).toBeNull()
  })
})

describe('buildQueryString', () => {
  it('returns empty string when no options are set', () => {
    const result = buildQueryString({})
    expect(result).toBe('')
  })

  it('includes state parameter', () => {
    const result = buildQueryString({ state: 'open' })
    expect(result).toBe('?state=open')
  })

  it('includes sort parameter', () => {
    const result = buildQueryString({ sort: 'created' })
    expect(result).toBe('?sort=created')
  })

  it('includes direction parameter', () => {
    const result = buildQueryString({ direction: 'asc' })
    expect(result).toBe('?direction=asc')
  })

  it('includes perPage parameter', () => {
    const result = buildQueryString({ perPage: 50 })
    expect(result).toBe('?per_page=50')
  })

  it('includes page parameter', () => {
    const result = buildQueryString({ page: 3 })
    expect(result).toBe('?page=3')
  })

  it('combines multiple parameters', () => {
    const options: ListPRsOptions = {
      state: 'closed',
      sort: 'updated',
      direction: 'desc',
      perPage: 25,
      page: 2,
    }
    const result = buildQueryString(options)
    expect(result).toContain('state=closed')
    expect(result).toContain('sort=updated')
    expect(result).toContain('direction=desc')
    expect(result).toContain('per_page=25')
    expect(result).toContain('page=2')
    expect(result[0]).toBe('?')
  })

  it('omits undefined optional fields', () => {
    const result = buildQueryString({ state: 'all' })
    expect(result).not.toContain('sort=')
    expect(result).not.toContain('direction=')
    expect(result).not.toContain('per_page=')
    expect(result).not.toContain('page=')
  })

  it('handles state=all', () => {
    const result = buildQueryString({ state: 'all' })
    expect(result).toBe('?state=all')
  })

  it('handles state=closed', () => {
    const result = buildQueryString({ state: 'closed' })
    expect(result).toBe('?state=closed')
  })

  it('handles sort=updated', () => {
    const result = buildQueryString({ sort: 'updated' })
    expect(result).toBe('?sort=updated')
  })

  it('handles direction=desc', () => {
    const result = buildQueryString({ direction: 'desc' })
    expect(result).toBe('?direction=desc')
  })

  it('handles page=1', () => {
    const result = buildQueryString({ page: 1 })
    expect(result).toBe('?page=1')
  })

  it('handles perPage=100', () => {
    const result = buildQueryString({ perPage: 100 })
    expect(result).toBe('?per_page=100')
  })
})

describe('parseRetryAfter', () => {
  it('returns milliseconds from Retry-After seconds header', () => {
    const headers = new Headers({ 'Retry-After': '60' })
    expect(parseRetryAfter(headers)).toBe(60000)
  })

  it('returns undefined when Retry-After header is missing', () => {
    const headers = new Headers()
    expect(parseRetryAfter(headers)).toBeUndefined()
  })

  it('returns undefined for non-numeric Retry-After', () => {
    const headers = new Headers({ 'Retry-After': 'invalid' })
    expect(parseRetryAfter(headers)).toBeUndefined()
  })

  it('returns undefined for zero Retry-After', () => {
    const headers = new Headers({ 'Retry-After': '0' })
    expect(parseRetryAfter(headers)).toBeUndefined()
  })

  it('returns undefined for negative Retry-After', () => {
    const headers = new Headers({ 'Retry-After': '-5' })
    expect(parseRetryAfter(headers)).toBeUndefined()
  })

  it('handles small Retry-After values', () => {
    const headers = new Headers({ 'Retry-After': '1' })
    expect(parseRetryAfter(headers)).toBe(1000)
  })
})

describe('429 rate limit handling', () => {
  it('attaches retryAfterMs to GitHubError for 429 responses', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse('Rate limited', {
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'Retry-After': '30' },
      }),
    )

    const result = await Effect.runPromiseExit(
      fetchGitHub('/test', TOKEN, SimpleSchema),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      const error = (result.cause as { _tag: string; error: GitHubError })
      expect(error.error).toBeInstanceOf(GitHubError)
      expect(error.error.status).toBe(429)
      expect(error.error.retryAfterMs).toBe(30000)
    }
  })

  it('sets retryAfterMs to undefined for 429 without Retry-After header', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse('Rate limited', {
        status: 429,
        statusText: 'Too Many Requests',
      }),
    )

    const result = await Effect.runPromiseExit(
      fetchGitHub('/test', TOKEN, SimpleSchema),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      const error = (result.cause as { _tag: string; error: GitHubError })
      expect(error.error.status).toBe(429)
      expect(error.error.retryAfterMs).toBeUndefined()
    }
  })

  it('does not attach retryAfterMs for non-429 errors', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse('Not Found', {
        status: 404,
        statusText: 'Not Found',
        headers: { 'Retry-After': '30' },
      }),
    )

    const result = await Effect.runPromiseExit(
      fetchGitHub('/test', TOKEN, SimpleSchema),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      const error = (result.cause as { _tag: string; error: GitHubError })
      expect(error.error.status).toBe(404)
      expect(error.error.retryAfterMs).toBeUndefined()
    }
  })
})

// ===========================================================================
// getGitHubRestUrl — GHE URL construction
// ===========================================================================

describe('getGitHubRestUrl', () => {
  it('returns default api.github.com when no baseUrl is provided', () => {
    expect(getGitHubRestUrl()).toBe('https://api.github.com')
  })

  it('returns default api.github.com when undefined is passed', () => {
    expect(getGitHubRestUrl(undefined)).toBe('https://api.github.com')
  })

  it('returns the GHE base URL when provided', () => {
    expect(getGitHubRestUrl('https://github.acme.com/api/v3')).toBe(
      'https://github.acme.com/api/v3',
    )
  })

  it('returns the base URL as-is for any custom URL', () => {
    expect(getGitHubRestUrl('https://custom-host.com/api/v3')).toBe(
      'https://custom-host.com/api/v3',
    )
  })

  it('returns api.github.com when explicitly passed', () => {
    expect(getGitHubRestUrl('https://api.github.com')).toBe(
      'https://api.github.com',
    )
  })
})

// ===========================================================================
// getGitHubGraphqlUrl — GHE GraphQL URL derivation
// ===========================================================================

describe('getGitHubGraphqlUrl', () => {
  it('returns default graphql URL when no baseUrl is provided', () => {
    expect(getGitHubGraphqlUrl()).toBe('https://api.github.com/graphql')
  })

  it('returns default graphql URL when undefined is passed', () => {
    expect(getGitHubGraphqlUrl(undefined)).toBe(
      'https://api.github.com/graphql',
    )
  })

  it('returns default graphql URL when api.github.com is passed', () => {
    expect(getGitHubGraphqlUrl('https://api.github.com')).toBe(
      'https://api.github.com/graphql',
    )
  })

  it('derives GHE graphql URL from /api/v3 base', () => {
    expect(getGitHubGraphqlUrl('https://github.acme.com/api/v3')).toBe(
      'https://github.acme.com/api/graphql',
    )
  })

  it('derives GHE graphql URL for another host', () => {
    expect(getGitHubGraphqlUrl('https://github.internal.io/api/v3')).toBe(
      'https://github.internal.io/api/graphql',
    )
  })

  it('appends /graphql for non-standard base URLs', () => {
    expect(getGitHubGraphqlUrl('https://custom-host.com/api')).toBe(
      'https://custom-host.com/api/graphql',
    )
  })
})

// ===========================================================================
// GHE baseUrl parameter threading
// ===========================================================================

describe('GHE baseUrl parameter', () => {
  it('fetchGitHub uses custom baseUrl when provided', async () => {
    const mockData = { id: 1, name: 'test' }
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(mockData))

    await Effect.runPromise(
      fetchGitHub('/test/path', TOKEN, SimpleSchema, 'https://ghe.acme.com/api/v3'),
    )

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://ghe.acme.com/api/v3/test/path',
      expect.any(Object),
    )
  })

  it('mutateGitHub uses custom baseUrl when provided', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse({}, { status: 200 }),
    )

    await Effect.runPromise(
      mutateGitHub('POST', '/test', TOKEN, { key: 'val' }, 'https://ghe.acme.com/api/v3'),
    )

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://ghe.acme.com/api/v3/test',
      expect.any(Object),
    )
  })

  it('mutateGitHubJson uses custom baseUrl when provided', async () => {
    const responseData = { id: 42 }
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(responseData))

    await Effect.runPromise(
      mutateGitHubJson<{ id: number }>('POST', '/test', TOKEN, {}, 'https://ghe.acme.com/api/v3'),
    )

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://ghe.acme.com/api/v3/test',
      expect.any(Object),
    )
  })

  it('graphqlGitHub uses GHE graphql URL when baseUrl is provided', async () => {
    const graphqlResponse = { data: { viewer: { login: 'user' } } }
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(graphqlResponse))

    await Effect.runPromise(
      graphqlGitHub(TOKEN, 'query { viewer { login } }', {}, 'https://ghe.acme.com/api/v3'),
    )

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://ghe.acme.com/api/graphql',
      expect.any(Object),
    )
  })

  it('fetchGitHubSearch uses custom baseUrl when provided', async () => {
    const searchResponse = {
      total_count: 0,
      incomplete_results: false,
      items: [],
    }
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(searchResponse))

    await Effect.runPromise(
      fetchGitHubSearch('is:pr', TOKEN, 'https://ghe.acme.com/api/v3'),
    )

    const calledUrl = vi.mocked(globalThis.fetch).mock.calls[0][0] as string
    expect(calledUrl).toContain('https://ghe.acme.com/api/v3/search/issues')
  })

  it('fetchGitHubPaginated uses custom baseUrl when provided', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse([]))

    await Effect.runPromise(
      fetchGitHubPaginated('/test', TOKEN, SimpleSchema, 'https://ghe.acme.com/api/v3'),
    )

    const calledUrl = vi.mocked(globalThis.fetch).mock.calls[0][0] as string
    expect(calledUrl).toContain('https://ghe.acme.com/api/v3/test')
  })

  it('fetchGitHubSearchPaginated uses custom baseUrl when provided', async () => {
    const searchResponse = {
      total_count: 0,
      incomplete_results: false,
      items: [],
    }
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(searchResponse))

    await Effect.runPromise(
      fetchGitHubSearchPaginated('test', TOKEN, 'https://ghe.acme.com/api/v3'),
    )

    const calledUrl = vi.mocked(globalThis.fetch).mock.calls[0][0] as string
    expect(calledUrl).toContain('https://ghe.acme.com/api/v3/search/issues')
  })
})

describe('fetchGitHubSinglePage', () => {
  it('fetches a single page and returns items with hasNextPage false when no Link header', async () => {
    const items = [
      { id: 1, name: 'file1' },
      { id: 2, name: 'file2' },
    ]
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(items))

    const result = await Effect.runPromise(
      fetchGitHubSinglePage('/repos/owner/repo/pulls/1/files?per_page=100&page=1', TOKEN, SimpleSchema),
    )

    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toEqual({ id: 1, name: 'file1' })
    expect(result.items[1]).toEqual({ id: 2, name: 'file2' })
    expect(result.hasNextPage).toBe(false)
  })

  it('detects hasNextPage from Link header with rel="next"', async () => {
    const items = [{ id: 1, name: 'file1' }]
    const linkHeader = '<https://api.github.com/repos/owner/repo/pulls/1/files?per_page=100&page=2>; rel="next"'
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse(items, { headers: { Link: linkHeader } }),
    )

    const result = await Effect.runPromise(
      fetchGitHubSinglePage('/repos/owner/repo/pulls/1/files?per_page=100&page=1', TOKEN, SimpleSchema),
    )

    expect(result.items).toHaveLength(1)
    expect(result.hasNextPage).toBe(true)
  })

  it('sets hasNextPage false when Link header has no next', async () => {
    const items = [{ id: 1, name: 'file1' }]
    const linkHeader = '<https://api.github.com/repos/owner/repo/pulls/1/files?per_page=100&page=1>; rel="prev"'
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse(items, { headers: { Link: linkHeader } }),
    )

    const result = await Effect.runPromise(
      fetchGitHubSinglePage('/repos/owner/repo/pulls/1/files?per_page=100&page=1', TOKEN, SimpleSchema),
    )

    expect(result.hasNextPage).toBe(false)
  })

  it('returns empty items array for empty response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse([]))

    const result = await Effect.runPromise(
      fetchGitHubSinglePage('/repos/owner/repo/pulls/1/files', TOKEN, SimpleSchema),
    )

    expect(result.items).toHaveLength(0)
    expect(result.hasNextPage).toBe(false)
  })

  it('throws GitHubError on non-OK response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse({ message: 'Not Found' }, { status: 404, statusText: 'Not Found' }),
    )

    const result = await Effect.runPromise(
      Effect.either(
        fetchGitHubSinglePage('/repos/owner/repo/pulls/999/files', TOKEN, SimpleSchema),
      ),
    )

    expect(result._tag).toBe('Left')
  })

  it('uses custom baseUrl when provided', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse([]))

    await Effect.runPromise(
      fetchGitHubSinglePage('/repos/owner/repo/pulls/1/files', TOKEN, SimpleSchema, 'https://ghe.acme.com/api/v3'),
    )

    const calledUrl = vi.mocked(globalThis.fetch).mock.calls[0][0] as string
    expect(calledUrl).toContain('https://ghe.acme.com/api/v3/repos/owner/repo/pulls/1/files')
  })
})

// ===========================================================================
// mapGitHubTimelineEvent — pure mapper for raw GitHub timeline events
// ===========================================================================

describe('mapGitHubTimelineEvent', () => {
  it('maps a committed event to a commit TimelineEvent', () => {
    const raw = {
      event: 'committed',
      sha: 'abc123def456',
      message: 'fix: resolve issue',
      author: { name: 'testuser', email: 'test@example.com', date: '2025-06-01T12:00:00Z' },
      committer: { name: 'testuser', email: 'test@example.com', date: '2025-06-01T12:00:00Z' },
    }

    const result = mapGitHubTimelineEvent(raw)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('commit')
    if (result!.type === 'commit') {
      expect(result!.sha).toBe('abc123def456')
      expect(result!.message).toBe('fix: resolve issue')
      expect(result!.author.login).toBe('testuser')
      expect(result!.timestamp).toBe('2025-06-01T12:00:00Z')
    }
  })

  it('maps a reviewed event to a review TimelineEvent', () => {
    const raw = {
      event: 'reviewed',
      id: 12345,
      state: 'approved',
      body: 'Looks good!',
      submitted_at: '2025-06-01T14:00:00Z',
      user: { login: 'reviewer1', avatar_url: 'https://example.com/avatar.png' },
    }

    const result = mapGitHubTimelineEvent(raw)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('review')
    if (result!.type === 'review') {
      expect(result!.state).toBe('APPROVED')
      expect(result!.body).toBe('Looks good!')
      expect(result!.author.login).toBe('reviewer1')
      expect(result!.author.avatarUrl).toBe('https://example.com/avatar.png')
      expect(result!.timestamp).toBe('2025-06-01T14:00:00Z')
    }
  })

  it('maps a commented event to a comment TimelineEvent', () => {
    const raw = {
      event: 'commented',
      id: 67890,
      created_at: '2025-06-01T15:00:00Z',
      body: 'Nice work',
      user: { login: 'commenter', avatar_url: 'https://example.com/av2.png' },
    }

    const result = mapGitHubTimelineEvent(raw)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('comment')
    if (result!.type === 'comment') {
      expect(result!.body).toBe('Nice work')
      expect(result!.author.login).toBe('commenter')
      expect(result!.timestamp).toBe('2025-06-01T15:00:00Z')
    }
  })

  it('maps a line-commented event with path and line info', () => {
    const raw = {
      event: 'line-commented',
      id: 11111,
      created_at: '2025-06-01T16:00:00Z',
      body: 'Needs fix here',
      user: { login: 'reviewer2' },
      path: 'src/app.ts',
      line: 42,
    }

    const result = mapGitHubTimelineEvent(raw)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('comment')
    if (result!.type === 'comment') {
      expect(result!.path).toBe('src/app.ts')
      expect(result!.line).toBe(42)
    }
  })

  it('maps a labeled event to a label-change TimelineEvent with added action', () => {
    const raw = {
      event: 'labeled',
      id: 22222,
      created_at: '2025-06-01T17:00:00Z',
      label: { name: 'bug', color: 'fc2929' },
      actor: { login: 'labeler', avatar_url: 'https://example.com/av3.png' },
    }

    const result = mapGitHubTimelineEvent(raw)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('label-change')
    if (result!.type === 'label-change') {
      expect(result!.action).toBe('added')
      expect(result!.label.name).toBe('bug')
      expect(result!.label.color).toBe('fc2929')
      expect(result!.actor.login).toBe('labeler')
    }
  })

  it('maps an unlabeled event to a label-change TimelineEvent with removed action', () => {
    const raw = {
      event: 'unlabeled',
      id: 33333,
      created_at: '2025-06-01T18:00:00Z',
      label: { name: 'wontfix', color: 'ffffff' },
      actor: { login: 'admin' },
    }

    const result = mapGitHubTimelineEvent(raw)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('label-change')
    if (result!.type === 'label-change') {
      expect(result!.action).toBe('removed')
    }
  })

  it('maps an assigned event to an assignee-change TimelineEvent', () => {
    const raw = {
      event: 'assigned',
      id: 44444,
      created_at: '2025-06-01T19:00:00Z',
      assignee: { login: 'dev1', avatar_url: 'https://example.com/av4.png' },
      actor: { login: 'manager' },
    }

    const result = mapGitHubTimelineEvent(raw)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('assignee-change')
    if (result!.type === 'assignee-change') {
      expect(result!.action).toBe('assigned')
      expect(result!.assignee.login).toBe('dev1')
      expect(result!.actor.login).toBe('manager')
    }
  })

  it('maps an unassigned event to an assignee-change TimelineEvent', () => {
    const raw = {
      event: 'unassigned',
      id: 55555,
      created_at: '2025-06-01T20:00:00Z',
      assignee: { login: 'dev1' },
      actor: { login: 'manager' },
    }

    const result = mapGitHubTimelineEvent(raw)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('assignee-change')
    if (result!.type === 'assignee-change') {
      expect(result!.action).toBe('unassigned')
    }
  })

  it('maps a head_ref_force_pushed event to a force-push TimelineEvent', () => {
    const raw = {
      event: 'head_ref_force_pushed',
      id: 66666,
      created_at: '2025-06-01T21:00:00Z',
      actor: { login: 'forcer', avatar_url: 'https://example.com/av5.png' },
      before_commit_id: 'aaa111',
      after_commit_id: 'bbb222',
    }

    const result = mapGitHubTimelineEvent(raw)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('force-push')
    if (result!.type === 'force-push') {
      expect(result!.beforeSha).toBe('aaa111')
      expect(result!.afterSha).toBe('bbb222')
      expect(result!.actor.login).toBe('forcer')
    }
  })

  it('returns null for unsupported event types', () => {
    expect(mapGitHubTimelineEvent({ event: 'renamed', id: 1 })).toBeNull()
    expect(mapGitHubTimelineEvent({ event: 'milestoned', id: 2 })).toBeNull()
    expect(mapGitHubTimelineEvent({ event: 'closed', id: 3 })).toBeNull()
    expect(mapGitHubTimelineEvent({ event: 'reopened', id: 4 })).toBeNull()
    expect(mapGitHubTimelineEvent({ event: 'referenced', id: 5 })).toBeNull()
    expect(mapGitHubTimelineEvent({ event: 'cross-referenced', id: 6 })).toBeNull()
  })

  it('handles reviewed event with null body', () => {
    const raw = {
      event: 'reviewed',
      id: 77777,
      state: 'changes_requested',
      body: null,
      submitted_at: '2025-06-01T22:00:00Z',
      user: { login: 'reviewer3' },
    }

    const result = mapGitHubTimelineEvent(raw)
    expect(result).not.toBeNull()
    if (result!.type === 'review') {
      expect(result!.body).toBe('')
      expect(result!.state).toBe('CHANGES_REQUESTED')
    }
  })

  it('handles committed event with committer date fallback', () => {
    const raw = {
      event: 'committed',
      sha: 'xyz789',
      message: 'chore: update deps',
      author: { name: 'author1', email: 'a@b.com' },
      committer: { name: 'committer1', email: 'c@d.com', date: '2025-06-02T10:00:00Z' },
    }

    const result = mapGitHubTimelineEvent(raw)
    expect(result).not.toBeNull()
    if (result!.type === 'commit') {
      expect(result!.timestamp).toBe('2025-06-02T10:00:00Z')
    }
  })

  it('handles events with missing optional fields gracefully', () => {
    const raw = {
      event: 'commented',
      id: 88888,
      created_at: '2025-06-02T11:00:00Z',
      body: null,
      user: { login: 'ghost' },
    }

    const result = mapGitHubTimelineEvent(raw)
    expect(result).not.toBeNull()
    if (result!.type === 'comment') {
      expect(result!.body).toBe('')
      expect(result!.author.avatarUrl).toBeUndefined()
    }
  })
})

// ===========================================================================
// fetchTimeline — integration test for the full helper
// ===========================================================================

describe('fetchTimeline', () => {
  it('calls the correct GitHub Timeline API endpoint', async () => {
    const timelineEvents = [
      {
        event: 'committed',
        sha: 'abc123',
        message: 'initial commit',
        author: { name: 'user1', email: 'u1@test.com', date: '2025-01-01T00:00:00Z' },
        committer: { name: 'user1', email: 'u1@test.com', date: '2025-01-01T00:00:00Z' },
      },
    ]
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(timelineEvents))

    await Effect.runPromise(
      fetchTimeline('owner', 'repo', 42, TOKEN),
    )

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/issues/42/timeline?per_page=100',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${TOKEN}`,
          Accept: 'application/vnd.github+json',
        }),
      }),
    )
  })

  it('maps and filters timeline events correctly', async () => {
    const timelineEvents = [
      {
        event: 'committed',
        sha: 'abc123',
        message: 'feat: add feature',
        author: { name: 'user1', email: 'u@test.com', date: '2025-01-01T00:00:00Z' },
        committer: { name: 'user1', email: 'u@test.com', date: '2025-01-01T00:00:00Z' },
      },
      {
        event: 'renamed',
        id: 999,
        created_at: '2025-01-01T01:00:00Z',
      },
      {
        event: 'labeled',
        id: 1000,
        created_at: '2025-01-01T02:00:00Z',
        label: { name: 'enhancement', color: '84b6eb' },
        actor: { login: 'user2' },
      },
    ]
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(timelineEvents))

    const result = await Effect.runPromise(
      fetchTimeline('owner', 'repo', 1, TOKEN),
    )

    expect(result).toHaveLength(2)
    expect(result[0].type).toBe('commit')
    expect(result[1].type).toBe('label-change')
  })

  it('returns empty array when all events are unsupported', async () => {
    const timelineEvents = [
      { event: 'renamed', id: 1 },
      { event: 'closed', id: 2 },
      { event: 'reopened', id: 3 },
    ]
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(timelineEvents))

    const result = await Effect.runPromise(
      fetchTimeline('owner', 'repo', 1, TOKEN),
    )

    expect(result).toHaveLength(0)
  })

  it('returns GitHubError on API failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      createMockResponse('Not Found', { status: 404, statusText: 'Not Found' }),
    )

    const result = await Effect.runPromiseExit(
      fetchTimeline('owner', 'repo', 999, TOKEN),
    )

    expect(result._tag).toBe('Failure')
  })

  it('returns NetworkError when fetch throws', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'))

    const result = await Effect.runPromiseExit(
      fetchTimeline('owner', 'repo', 1, TOKEN),
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      const error = (result.cause as { _tag: string; error: NetworkError })
      expect(error.error).toBeInstanceOf(NetworkError)
    }
  })

  it('uses custom baseUrl when provided', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse([]))

    await Effect.runPromise(
      fetchTimeline('owner', 'repo', 1, TOKEN, 'https://ghe.acme.com/api/v3'),
    )

    const calledUrl = vi.mocked(globalThis.fetch).mock.calls[0][0] as string
    expect(calledUrl).toContain('https://ghe.acme.com/api/v3/repos/owner/repo/issues/1/timeline')
  })

  it('follows pagination via Link header', async () => {
    const page1 = [
      {
        event: 'committed',
        sha: 'aaa',
        message: 'commit 1',
        author: { name: 'u1', email: 'u@t.com', date: '2025-01-01T00:00:00Z' },
        committer: { name: 'u1', email: 'u@t.com', date: '2025-01-01T00:00:00Z' },
      },
    ]
    const page2 = [
      {
        event: 'committed',
        sha: 'bbb',
        message: 'commit 2',
        author: { name: 'u1', email: 'u@t.com', date: '2025-01-02T00:00:00Z' },
        committer: { name: 'u1', email: 'u@t.com', date: '2025-01-02T00:00:00Z' },
      },
    ]

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(
        createMockResponse(page1, {
          headers: {
            Link: '<https://api.github.com/repos/owner/repo/issues/1/timeline?page=2&per_page=100>; rel="next"',
          },
        }),
      )
      .mockResolvedValueOnce(createMockResponse(page2))

    const result = await Effect.runPromise(
      fetchTimeline('owner', 'repo', 1, TOKEN),
    )

    expect(result).toHaveLength(2)
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })
})
