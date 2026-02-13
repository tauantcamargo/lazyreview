import { Effect } from 'effect'
import { GitLabError, NetworkError } from '../models/errors'
import { updateRateLimit } from '../hooks/useRateLimit'
import { touchLastUpdated } from '../hooks/useLastUpdated'
import { sanitizeApiError } from '../utils/sanitize'
import { notifyTokenExpired } from '../hooks/useTokenExpired'

const MAX_PAGES = 20

// ---------------------------------------------------------------------------
// URL builder
// ---------------------------------------------------------------------------

/**
 * Build a full GitLab API URL from base URL, path, and optional query params.
 */
export function buildGitLabUrl(
  baseUrl: string,
  path: string,
  params?: Record<string, string>,
): string {
  const url = `${baseUrl}${path}`
  if (!params || Object.keys(params).length === 0) return url

  const searchParams = new URLSearchParams(params)
  return `${url}?${searchParams.toString()}`
}

// ---------------------------------------------------------------------------
// Retry-After parsing
// ---------------------------------------------------------------------------

/**
 * Parse GitLab rate limit headers.
 *
 * GitLab uses `RateLimit-Reset` (epoch seconds) as the primary header,
 * with `Retry-After` (seconds) as a fallback.
 * Returns milliseconds to wait, or undefined if no header is present.
 */
export function parseGitLabRetryAfter(headers: Headers): number | undefined {
  // Primary: RateLimit-Reset is epoch seconds
  const rateLimitReset = headers.get('RateLimit-Reset')
  if (rateLimitReset) {
    const resetEpoch = parseInt(rateLimitReset, 10)
    if (Number.isFinite(resetEpoch) && resetEpoch > 0) {
      const nowSeconds = Math.floor(Date.now() / 1000)
      const diffSeconds = resetEpoch - nowSeconds
      return diffSeconds > 0 ? diffSeconds * 1000 : 1000
    }
  }

  // Fallback: Retry-After in seconds
  const retryAfter = headers.get('Retry-After')
  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10)
    if (Number.isFinite(seconds) && seconds > 0) {
      return seconds * 1000
    }
  }

  return undefined
}

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

/**
 * Map a GitLab API error response to a GitLabError.
 *
 * GitLab returns errors in two formats:
 * - `{ message: string }` (most common)
 * - `{ error: string }` (OAuth errors)
 */
export function mapGitLabError(
  response: Response,
  body: string,
): GitLabError {
  if (response.status === 401) {
    notifyTokenExpired()
  }

  let detail: string = body
  try {
    const parsed = JSON.parse(body)
    if (typeof parsed === 'object' && parsed !== null) {
      detail = parsed.message ?? parsed.error ?? body
    }
  } catch {
    // body is not JSON, use as-is
  }

  return new GitLabError({
    message: sanitizeApiError(response.status, response.statusText),
    detail,
    status: response.status,
    retryAfterMs:
      response.status === 429
        ? parseGitLabRetryAfter(response.headers)
        : undefined,
  })
}

// ---------------------------------------------------------------------------
// GitLab rate limit header update
// ---------------------------------------------------------------------------

/**
 * Update the rate limit store from GitLab response headers.
 *
 * GitLab may use either ratelimit-* or x-ratelimit-* headers.
 * The shared updateRateLimit function handles both formats.
 */
function updateGitLabRateLimit(headers: Headers): void {
  updateRateLimit(headers)
}

// ---------------------------------------------------------------------------
// Auth header builder
// ---------------------------------------------------------------------------

/**
 * Build GitLab authentication headers.
 *
 * GitLab supports two auth mechanisms:
 * - `PRIVATE-TOKEN: <token>` for personal access tokens (PATs)
 * - `Authorization: Bearer <token>` for OAuth tokens
 *
 * We use PRIVATE-TOKEN since PATs are the most common authentication method.
 */
function buildAuthHeaders(token: string): Record<string, string> {
  return {
    'PRIVATE-TOKEN': token,
    'Content-Type': 'application/json',
  }
}

// ---------------------------------------------------------------------------
// Core fetch helper
// ---------------------------------------------------------------------------

/**
 * Perform a raw GitLab API fetch.
 *
 * Returns the Response directly -- callers decide whether to parse JSON,
 * handle 204 No Content, etc.
 *
 * - Uses `PRIVATE-TOKEN` header for authentication
 * - Updates rate limit store from response headers
 * - Returns GitLabError on non-2xx responses
 * - Returns NetworkError when fetch itself fails
 */
export function gitlabFetch(
  path: string,
  baseUrl: string,
  token: string,
  options?: RequestInit,
): Effect.Effect<Response, GitLabError | NetworkError> {
  const url = buildGitLabUrl(baseUrl, path)

  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...buildAuthHeaders(token),
          ...options?.headers,
        },
      })

      updateGitLabRateLimit(response.headers)

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw mapGitLabError(response, body)
      }

      touchLastUpdated()
      return response
    },
    catch: (error) => {
      if (error instanceof GitLabError) return error
      return new NetworkError({
        message: `Network request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        cause: error,
      })
    },
  })
}

// ---------------------------------------------------------------------------
// JSON fetch helper
// ---------------------------------------------------------------------------

/**
 * Fetch a GitLab API endpoint and parse the JSON response.
 *
 * Combines auth, error handling, and JSON parsing for the common case
 * of endpoints that return a JSON object or array.
 */
export function gitlabFetchJson<T>(
  path: string,
  baseUrl: string,
  token: string,
  options?: RequestInit,
): Effect.Effect<T, GitLabError | NetworkError> {
  const url = buildGitLabUrl(baseUrl, path)

  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...buildAuthHeaders(token),
          ...options?.headers,
        },
      })

      updateGitLabRateLimit(response.headers)

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw mapGitLabError(response, body)
      }

      touchLastUpdated()
      const data = await response.json()
      return data as T
    },
    catch: (error) => {
      if (error instanceof GitLabError) return error
      return new NetworkError({
        message: `Network request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        cause: error,
      })
    },
  })
}

// ---------------------------------------------------------------------------
// Paginated fetch helper
// ---------------------------------------------------------------------------

/**
 * Fetch all pages of a paginated GitLab REST API endpoint.
 *
 * GitLab uses header-based pagination:
 * - `X-Page` -- current page number
 * - `X-Per-Page` -- items per page
 * - `X-Next-Page` -- next page number (empty string if no more pages)
 * - `X-Total` -- total number of items
 *
 * Fetches up to MAX_PAGES pages (20) to prevent runaway pagination.
 * Items are concatenated across all pages.
 */
export function gitlabFetchAllPages<T>(
  path: string,
  baseUrl: string,
  token: string,
  params?: Record<string, string>,
): Effect.Effect<T[], GitLabError | NetworkError> {
  return Effect.tryPromise({
    try: async () => {
      const allItems: T[] = []
      let page = 1
      let pageCount = 0

      const baseParams: Record<string, string> = {
        per_page: '100',
        ...params,
      }

      while (pageCount < MAX_PAGES) {
        pageCount++
        const pageParams = { ...baseParams, page: String(page) }
        const url = buildGitLabUrl(baseUrl, path, pageParams)

        const response = await fetch(url, {
          headers: buildAuthHeaders(token),
        })

        updateGitLabRateLimit(response.headers)

        if (!response.ok) {
          const body = await response.text().catch(() => '')
          throw mapGitLabError(response, body)
        }

        const data = await response.json()
        const items = data as T[]
        allItems.push(...items)

        // Check for next page via X-Next-Page header
        const nextPage = response.headers.get('x-next-page')
        if (!nextPage || nextPage.trim() === '') {
          break
        }

        page = parseInt(nextPage, 10)
        if (!Number.isFinite(page) || page <= 0) {
          break
        }
      }

      touchLastUpdated()
      return allItems
    },
    catch: (error) => {
      if (error instanceof GitLabError) return error
      return new NetworkError({
        message: `Network request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        cause: error,
      })
    },
  })
}
