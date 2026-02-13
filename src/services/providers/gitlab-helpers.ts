import { Effect } from 'effect'
import { GitHubError, NetworkError } from '../../models/errors'
import { sanitizeApiError } from '../../utils/sanitize'
import { updateRateLimit } from '../../hooks/useRateLimit'
import { touchLastUpdated } from '../../hooks/useLastUpdated'
import { notifyTokenExpired } from '../../hooks/useTokenExpired'

// ---------------------------------------------------------------------------
// GitLab project path encoding
// ---------------------------------------------------------------------------

/**
 * Encode a GitLab project path (owner/repo) for use in API URLs.
 * GitLab uses URL-encoded project paths as identifiers.
 */
export function encodeProjectPath(owner: string, repo: string): string {
  return encodeURIComponent(`${owner}/${repo}`)
}

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

function buildGitLabError(
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
      response.status === 429
        ? parseRetryAfter(response.headers)
        : undefined,
  })
}

/**
 * Parse GitLab's Retry-After header.
 * GitLab sends Retry-After as seconds.
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

// ---------------------------------------------------------------------------
// GitLab auth headers
// ---------------------------------------------------------------------------

function gitlabHeaders(token: string): Record<string, string> {
  return {
    'PRIVATE-TOKEN': token,
    'Content-Type': 'application/json',
  }
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

/**
 * Execute a GitLab API mutation (POST/PUT/DELETE) that returns no data.
 */
export function mutateGitLab(
  method: 'POST' | 'PUT' | 'DELETE',
  baseUrl: string,
  path: string,
  token: string,
  body: Record<string, unknown>,
): Effect.Effect<void, GitHubError | NetworkError> {
  const url = `${baseUrl}${path}`

  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        method,
        headers: gitlabHeaders(token),
        body: JSON.stringify(body),
      })

      updateRateLimit(response.headers)

      if (!response.ok) {
        const responseBody = await response.text().catch(() => '')
        throw buildGitLabError(response, responseBody, url)
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

/**
 * Execute a GitLab API mutation that returns JSON data.
 */
export function mutateGitLabJson<T>(
  method: 'POST' | 'PUT' | 'DELETE',
  baseUrl: string,
  path: string,
  token: string,
  body: Record<string, unknown>,
): Effect.Effect<T, GitHubError | NetworkError> {
  const url = `${baseUrl}${path}`

  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        method,
        headers: gitlabHeaders(token),
        body: JSON.stringify(body),
      })

      updateRateLimit(response.headers)

      if (!response.ok) {
        const responseBody = await response.text().catch(() => '')
        throw buildGitLabError(response, responseBody, url)
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

/**
 * Execute a GitLab API GET that returns JSON data.
 */
export function fetchGitLab<T>(
  baseUrl: string,
  path: string,
  token: string,
): Effect.Effect<T, GitHubError | NetworkError> {
  const url = `${baseUrl}${path}`

  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        headers: {
          'PRIVATE-TOKEN': token,
        },
      })

      updateRateLimit(response.headers)

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw buildGitLabError(response, body, url)
      }

      touchLastUpdated()
      const data = await response.json()
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
