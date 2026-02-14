import { Effect } from 'effect'
import { GiteaError, NetworkError } from '../models/errors'
import { updateRateLimit } from '../hooks/useRateLimit'
import { touchLastUpdated } from '../hooks/useLastUpdated'
import { sanitizeApiError } from '../utils/sanitize'
import { notifyTokenExpired } from '../hooks/useTokenExpired'

const MAX_PAGES = 20

// ---------------------------------------------------------------------------
// URL builder
// ---------------------------------------------------------------------------

/**
 * Build a full Gitea API URL from base URL, path, and optional query params.
 */
export function buildGiteaUrl(
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
 * Parse Gitea rate limit retry-after information.
 *
 * Gitea uses `Retry-After` header (seconds) when rate-limited (429).
 * Returns milliseconds to wait, or undefined if no header is present.
 */
export function parseGiteaRetryAfter(headers: Headers): number | undefined {
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
 * Map a Gitea API error response to a GiteaError.
 *
 * Gitea returns errors in several formats:
 * - `{ message: string }` (most common)
 * - `{ message: string, url: string }` (with documentation link)
 */
export function mapGiteaError(
  response: Response,
  body: string,
  url?: string,
): GiteaError {
  if (response.status === 401) {
    notifyTokenExpired()
  }

  let detail: string = body
  try {
    const parsed = JSON.parse(body)
    if (typeof parsed === 'object' && parsed !== null) {
      if (typeof parsed.message === 'string') {
        detail = parsed.message
      }
    }
  } catch {
    // body is not JSON, use as-is
  }

  return new GiteaError({
    message: sanitizeApiError(response.status, response.statusText),
    detail,
    status: response.status,
    url,
    retryAfterMs:
      response.status === 429
        ? parseGiteaRetryAfter(response.headers)
        : undefined,
  })
}

// ---------------------------------------------------------------------------
// Rate limit header update
// ---------------------------------------------------------------------------

/**
 * Update the rate limit store from Gitea response headers.
 *
 * Gitea provides rate limit headers:
 * - X-RateLimit-Limit
 * - X-RateLimit-Remaining
 * - X-RateLimit-Reset
 */
function updateGiteaRateLimit(headers: Headers): void {
  updateRateLimit(headers)
}

// ---------------------------------------------------------------------------
// Auth header builder
// ---------------------------------------------------------------------------

/**
 * Build Gitea authentication headers.
 *
 * Gitea uses `Authorization: token <pat>` (not Bearer).
 */
function buildAuthHeaders(token: string): Record<string, string> {
  return {
    Authorization: `token ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

// ---------------------------------------------------------------------------
// Core fetch helper
// ---------------------------------------------------------------------------

/**
 * Perform a raw Gitea API fetch.
 *
 * Returns the Response directly -- callers decide whether to parse JSON,
 * handle 204 No Content, etc.
 */
export function giteaFetch(
  path: string,
  baseUrl: string,
  token: string,
  options?: RequestInit,
): Effect.Effect<Response, GiteaError | NetworkError> {
  const url = buildGiteaUrl(baseUrl, path)

  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...buildAuthHeaders(token),
          ...options?.headers,
        },
      })

      updateGiteaRateLimit(response.headers)

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw mapGiteaError(response, body, url)
      }

      touchLastUpdated()
      return response
    },
    catch: (error) => {
      if (error instanceof GiteaError) return error
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
 * Fetch a Gitea API endpoint and parse the JSON response.
 */
export function giteaFetchJson<T>(
  path: string,
  baseUrl: string,
  token: string,
  params?: Record<string, string>,
  options?: RequestInit,
): Effect.Effect<T, GiteaError | NetworkError> {
  const url = buildGiteaUrl(baseUrl, path, params)

  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...buildAuthHeaders(token),
          ...options?.headers,
        },
      })

      updateGiteaRateLimit(response.headers)

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw mapGiteaError(response, body, url)
      }

      touchLastUpdated()
      const data = await response.json()
      return data as T
    },
    catch: (error) => {
      if (error instanceof GiteaError) return error
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
 * Fetch all pages of a paginated Gitea REST API endpoint.
 *
 * Gitea uses `page` and `limit` query params for pagination.
 * The response header `X-Total-Count` indicates the total number of items.
 * Fetches up to MAX_PAGES pages to prevent runaway pagination.
 */
export function giteaFetchAllPages<T>(
  path: string,
  baseUrl: string,
  token: string,
  params?: Record<string, string>,
): Effect.Effect<T[], GiteaError | NetworkError> {
  return Effect.tryPromise({
    try: async () => {
      const allItems: T[] = []
      let page = 1

      const baseParams: Record<string, string> = {
        limit: '50',
        ...params,
      }

      while (page <= MAX_PAGES) {
        const pageParams = { ...baseParams, page: String(page) }
        const url = buildGiteaUrl(baseUrl, path, pageParams)

        const response = await fetch(url, {
          headers: buildAuthHeaders(token),
        })

        updateGiteaRateLimit(response.headers)

        if (!response.ok) {
          const body = await response.text().catch(() => '')
          throw mapGiteaError(response, body, url)
        }

        const data = (await response.json()) as T[]

        if (!Array.isArray(data) || data.length === 0) {
          break
        }

        allItems.push(...data)

        // Check if we have all items using X-Total-Count header
        const totalCountHeader = response.headers.get('X-Total-Count')
        if (totalCountHeader) {
          const totalCount = parseInt(totalCountHeader, 10)
          if (Number.isFinite(totalCount) && allItems.length >= totalCount) {
            break
          }
        }

        // If returned fewer items than the limit, we're done
        const limit = parseInt(baseParams.limit ?? '50', 10)
        if (data.length < limit) {
          break
        }

        page++
      }

      touchLastUpdated()
      return allItems
    },
    catch: (error) => {
      if (error instanceof GiteaError) return error
      return new NetworkError({
        message: `Network request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        cause: error,
      })
    },
  })
}

// ---------------------------------------------------------------------------
// Mutation helper (POST/PUT/PATCH/DELETE)
// ---------------------------------------------------------------------------

/**
 * Execute a Gitea API mutation that returns no data (or we discard it).
 */
export function mutateGitea(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  baseUrl: string,
  path: string,
  token: string,
  body?: Record<string, unknown>,
): Effect.Effect<void, GiteaError | NetworkError> {
  const url = buildGiteaUrl(baseUrl, path)

  return Effect.tryPromise({
    try: async () => {
      const options: RequestInit = {
        method,
        headers: buildAuthHeaders(token),
      }

      if (body !== undefined) {
        options.body = JSON.stringify(body)
      }

      const response = await fetch(url, options)

      updateGiteaRateLimit(response.headers)

      if (!response.ok) {
        const responseBody = await response.text().catch(() => '')
        throw mapGiteaError(response, responseBody, url)
      }

      touchLastUpdated()
    },
    catch: (error) => {
      if (error instanceof GiteaError) return error
      return new NetworkError({
        message: `Network request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        cause: error,
      })
    },
  })
}

/**
 * Execute a Gitea API mutation that returns JSON data.
 */
export function mutateGiteaJson<T>(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  baseUrl: string,
  path: string,
  token: string,
  body: Record<string, unknown>,
): Effect.Effect<T, GiteaError | NetworkError> {
  const url = buildGiteaUrl(baseUrl, path)

  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        method,
        headers: buildAuthHeaders(token),
        body: JSON.stringify(body),
      })

      updateGiteaRateLimit(response.headers)

      if (!response.ok) {
        const responseBody = await response.text().catch(() => '')
        throw mapGiteaError(response, responseBody, url)
      }

      touchLastUpdated()
      const data = await response.json()
      return data as T
    },
    catch: (error) => {
      if (error instanceof GiteaError) return error
      return new NetworkError({
        message: `Network request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        cause: error,
      })
    },
  })
}

/**
 * Fetch raw text content from a Gitea API endpoint.
 * Used for getting diff content.
 */
export function giteaFetchText(
  path: string,
  baseUrl: string,
  token: string,
  accept?: string,
): Effect.Effect<string, GiteaError | NetworkError> {
  const url = buildGiteaUrl(baseUrl, path)

  return Effect.tryPromise({
    try: async () => {
      const headers: Record<string, string> = {
        Authorization: `token ${token}`,
      }
      if (accept) {
        headers.Accept = accept
      }

      const response = await fetch(url, { headers })

      updateGiteaRateLimit(response.headers)

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw mapGiteaError(response, body, url)
      }

      touchLastUpdated()
      return await response.text()
    },
    catch: (error) => {
      if (error instanceof GiteaError) return error
      return new NetworkError({
        message: `Network request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        cause: error,
      })
    },
  })
}
