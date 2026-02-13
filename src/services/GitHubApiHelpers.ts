import { Effect, Schema as S } from 'effect'
import { GitHubError, NetworkError } from '../models/errors'
import { PullRequest } from '../models/pull-request'
import { updateRateLimit } from '../hooks/useRateLimit'
import { touchLastUpdated } from '../hooks/useLastUpdated'
import { sanitizeApiError } from '../utils/sanitize'
import { notifyTokenExpired } from '../hooks/useTokenExpired'
import type { ListPRsOptions } from './GitHubApiTypes'

const MAX_PAGES = 20

const BASE_URL = 'https://api.github.com'

/**
 * Parse the Retry-After header from a 429 response.
 * Returns milliseconds to wait, or undefined if header is missing/unparseable.
 * GitHub sends Retry-After as seconds.
 */
export function parseRetryAfter(headers: Headers): number | undefined {
  const retryAfter = headers.get('Retry-After')
  if (!retryAfter) return undefined

  const seconds = parseInt(retryAfter, 10)
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds * 1000
  }

  return undefined
}

/**
 * Build a GitHubError from a non-OK response, attaching retryAfterMs for 429s.
 * Also notifies token expiration for 401 responses.
 */
function buildGitHubError(
  response: Response,
  body: string,
  url: string,
): GitHubError {
  if (response.status === 401) {
    notifyTokenExpired()
  }

  return new GitHubError({
    message: sanitizeApiError(response.status, response.statusText),
    detail: body,
    status: response.status,
    url,
    retryAfterMs:
      response.status === 429 ? parseRetryAfter(response.headers) : undefined,
  })
}

// Schema for GitHub Search API response
const SearchResultSchema = S.Struct({
  total_count: S.Number,
  incomplete_results: S.Boolean,
  items: S.Array(PullRequest),
})

export function fetchGitHub<A, I>(
  path: string,
  token: string,
  schema: S.Schema<A, I>,
): Effect.Effect<A, GitHubError | NetworkError> {
  const url = `${BASE_URL}${path}`
  const decode = S.decodeUnknownSync(schema)

  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })

      updateRateLimit(response.headers)

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw buildGitHubError(response, body, url)
      }

      const data = await response.json()
      touchLastUpdated()
      return decode(data)
    },
    catch: (error) => {
      if (error instanceof GitHubError) return error
      return new NetworkError({
        message: `Network request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        cause: error,
      })
    },
  })
}

export function mutateGitHub(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  token: string,
  body: Record<string, unknown>,
): Effect.Effect<void, GitHubError | NetworkError> {
  const url = `${BASE_URL}${path}`

  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify(body),
      })

      updateRateLimit(response.headers)

      if (!response.ok) {
        const responseBody = await response.text().catch(() => '')
        throw buildGitHubError(response, responseBody, url)
      }

      touchLastUpdated()
    },
    catch: (error) => {
      if (error instanceof GitHubError) return error
      return new NetworkError({
        message: `Network request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        cause: error,
      })
    },
  })
}

export function mutateGitHubJson<T>(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  token: string,
  body: Record<string, unknown>,
): Effect.Effect<T, GitHubError | NetworkError> {
  const url = `${BASE_URL}${path}`

  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify(body),
      })

      updateRateLimit(response.headers)

      if (!response.ok) {
        const responseBody = await response.text().catch(() => '')
        throw buildGitHubError(response, responseBody, url)
      }

      touchLastUpdated()
      const data = await response.json()
      if (data == null || typeof data !== 'object') {
        throw new GitHubError({
          message: 'Unexpected API response: expected JSON object',
          status: response.status,
          url,
        })
      }
      return data as T
    },
    catch: (error) => {
      if (error instanceof GitHubError) return error
      return new NetworkError({
        message: `Network request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        cause: error,
      })
    },
  })
}

export function graphqlGitHub<T>(
  token: string,
  query: string,
  variables: Record<string, unknown>,
): Effect.Effect<T, GitHubError | NetworkError> {
  const url = 'https://api.github.com/graphql'

  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({ query, variables }),
      })

      updateRateLimit(response.headers)

      if (!response.ok) {
        const responseBody = await response.text().catch(() => '')
        throw buildGitHubError(response, responseBody, url)
      }

      const data = await response.json()
      if (data.errors) {
        throw new GitHubError({
          message: 'GraphQL request returned errors.',
          detail: JSON.stringify(data.errors),
          status: 200,
          url,
        })
      }

      touchLastUpdated()
      if (data.data == null || typeof data.data !== 'object') {
        throw new GitHubError({
          message: 'Unexpected GraphQL response: missing data field',
          status: 200,
          url,
        })
      }
      return data.data as T
    },
    catch: (error) => {
      if (error instanceof GitHubError) return error
      return new NetworkError({
        message: `Network request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        cause: error,
      })
    },
  })
}

export function fetchGitHubSearch(
  query: string,
  token: string,
): Effect.Effect<readonly PullRequest[], GitHubError | NetworkError> {
  const url = `${BASE_URL}/search/issues?q=${encodeURIComponent(query)}&per_page=100`
  const decode = S.decodeUnknownSync(SearchResultSchema)

  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })

      updateRateLimit(response.headers)

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw buildGitHubError(response, body, url)
      }

      const data = await response.json()
      touchLastUpdated()
      const result = decode(data)
      return result.items
    },
    catch: (error) => {
      if (error instanceof GitHubError) return error
      return new NetworkError({
        message: `Network request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        cause: error,
      })
    },
  })
}

/**
 * Parse GitHub's Link header to extract the "next" page URL.
 * Format: `<url>; rel="next", <url>; rel="last"`
 */
export function parseLinkHeader(header: string | null): string | null {
  if (!header) return null

  const links = header.split(',')
  for (const link of links) {
    const match = link.match(/<([^>]+)>;\s*rel="next"/)
    if (match?.[1]) {
      return match[1]
    }
  }

  return null
}

/**
 * Fetch all pages of a paginated GitHub REST API endpoint.
 * Follows Link header rel="next" until exhausted.
 * Items are concatenated across all pages.
 */
export function fetchGitHubPaginated<A, I>(
  path: string,
  token: string,
  schema: S.Schema<A, I>,
): Effect.Effect<readonly A[], GitHubError | NetworkError> {
  const decode = S.decodeUnknownSync(S.Array(schema))

  return Effect.tryPromise({
    try: async () => {
      const allItems: A[] = []
      let url: string | null = `${BASE_URL}${path}`
      let pageCount = 0

      // Ensure per_page=100 is set if not already present
      if (!url.includes('per_page=')) {
        url += url.includes('?') ? '&per_page=100' : '?per_page=100'
      }

      while (url && pageCount < MAX_PAGES) {
        pageCount++
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        })

        updateRateLimit(response.headers)

        if (!response.ok) {
          const body = await response.text().catch(() => '')
          throw buildGitHubError(response, body, url)
        }

        const data = await response.json()
        const items = decode(data)
        allItems.push(...items)

        // Follow pagination via Link header
        const linkHeader = response.headers.get('Link')
        url = parseLinkHeader(linkHeader)
      }

      touchLastUpdated()
      return allItems
    },
    catch: (error) => {
      if (error instanceof GitHubError) return error
      return new NetworkError({
        message: `Network request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        cause: error,
      })
    },
  })
}

/**
 * Fetch all pages of the GitHub Search API.
 * Follows Link header rel="next" until exhausted.
 * Search API returns { total_count, items } per page.
 */
export function fetchGitHubSearchPaginated(
  query: string,
  token: string,
): Effect.Effect<readonly PullRequest[], GitHubError | NetworkError> {
  const decode = S.decodeUnknownSync(SearchResultSchema)

  return Effect.tryPromise({
    try: async () => {
      const allItems: PullRequest[] = []
      let url: string | null = `${BASE_URL}/search/issues?q=${encodeURIComponent(query)}&per_page=100`
      let pageCount = 0

      while (url && pageCount < MAX_PAGES) {
        pageCount++
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        })

        updateRateLimit(response.headers)

        if (!response.ok) {
          const body = await response.text().catch(() => '')
          throw buildGitHubError(response, body, url)
        }

        const data = await response.json()
        const result = decode(data)
        allItems.push(...result.items)

        // Follow pagination via Link header
        const linkHeader = response.headers.get('Link')
        url = parseLinkHeader(linkHeader)
      }

      touchLastUpdated()
      return allItems
    },
    catch: (error) => {
      if (error instanceof GitHubError) return error
      return new NetworkError({
        message: `Network request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        cause: error,
      })
    },
  })
}

export function buildQueryString(options: ListPRsOptions): string {
  const params = new URLSearchParams()
  if (options.state) params.set('state', options.state)
  if (options.sort) params.set('sort', options.sort)
  if (options.direction) params.set('direction', options.direction)
  if (options.perPage) params.set('per_page', String(options.perPage))
  if (options.page) params.set('page', String(options.page))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}
