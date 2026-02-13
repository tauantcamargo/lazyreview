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
  parseLinkHeader,
  buildQueryString,
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
