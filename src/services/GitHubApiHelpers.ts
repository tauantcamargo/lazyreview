import { Effect, Schema as S } from 'effect'
import { GitHubError, NetworkError } from '../models/errors'
import { PullRequest } from '../models/pull-request'
import { updateRateLimit } from '../hooks/useRateLimit'
import { touchLastUpdated } from '../hooks/useLastUpdated'
import type { ListPRsOptions } from './GitHubApiTypes'

const BASE_URL = 'https://api.github.com'

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
        throw new GitHubError({
          message: `GitHub API error: ${response.status} ${response.statusText} - ${body}`,
          status: response.status,
          url,
        })
      }

      const data = await response.json()
      touchLastUpdated()
      return decode(data)
    },
    catch: (error) => {
      if (error instanceof GitHubError) return error
      return new NetworkError({
        message: `Network request failed: ${String(error)}`,
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
        throw new GitHubError({
          message: `GitHub API error: ${response.status} ${response.statusText} - ${responseBody}`,
          status: response.status,
          url,
        })
      }

      touchLastUpdated()
    },
    catch: (error) => {
      if (error instanceof GitHubError) return error
      return new NetworkError({
        message: `Network request failed: ${String(error)}`,
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
        throw new GitHubError({
          message: `GitHub API error: ${response.status} ${response.statusText} - ${responseBody}`,
          status: response.status,
          url,
        })
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
        message: `Network request failed: ${String(error)}`,
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
        throw new GitHubError({
          message: `GitHub GraphQL error: ${response.status} ${response.statusText} - ${responseBody}`,
          status: response.status,
          url,
        })
      }

      const data = await response.json()
      if (data.errors) {
        throw new GitHubError({
          message: `GitHub GraphQL error: ${JSON.stringify(data.errors)}`,
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
        message: `Network request failed: ${String(error)}`,
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
        throw new GitHubError({
          message: `GitHub API error: ${response.status} ${response.statusText} - ${body}`,
          status: response.status,
          url,
        })
      }

      const data = await response.json()
      touchLastUpdated()
      const result = decode(data)
      return result.items
    },
    catch: (error) => {
      if (error instanceof GitHubError) return error
      return new NetworkError({
        message: `Network request failed: ${String(error)}`,
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
