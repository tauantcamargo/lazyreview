import { Effect } from 'effect'
import { BitbucketError, NetworkError } from '../models/errors'
import { updateRateLimit } from '../hooks/useRateLimit'
import { touchLastUpdated } from '../hooks/useLastUpdated'
import { sanitizeApiError } from '../utils/sanitize'
import { notifyTokenExpired } from '../hooks/useTokenExpired'

const MAX_PAGES = 20

// ---------------------------------------------------------------------------
// URL builder
// ---------------------------------------------------------------------------

/**
 * Build a full Bitbucket API URL from base URL, path, and optional query params.
 */
export function buildBitbucketUrl(
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
 * Parse Bitbucket rate limit retry-after information.
 *
 * Bitbucket uses `Retry-After` header (seconds) when rate-limited (429).
 * Returns milliseconds to wait, or undefined if no header is present.
 */
export function parseBitbucketRetryAfter(headers: Headers): number | undefined {
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
 * Map a Bitbucket API error response to a BitbucketError.
 *
 * Bitbucket returns errors in several formats:
 * - `{ error: { message: string } }` (most common)
 * - `{ error: string }` (simpler variant)
 * - `{ type: "error", error: { message: string, detail?: string } }` (v2.0 typed errors)
 */
export function mapBitbucketError(
  response: Response,
  body: string,
): BitbucketError {
  if (response.status === 401) {
    notifyTokenExpired()
  }

  let detail: string = body
  try {
    const parsed = JSON.parse(body)
    if (typeof parsed === 'object' && parsed !== null) {
      // Bitbucket v2.0 nested error format: { error: { message: string } }
      if (typeof parsed.error === 'object' && parsed.error !== null) {
        detail = parsed.error.message ?? parsed.error.detail ?? body
      } else if (typeof parsed.error === 'string') {
        detail = parsed.error
      } else if (typeof parsed.message === 'string') {
        detail = parsed.message
      }
    }
  } catch {
    // body is not JSON, use as-is
  }

  return new BitbucketError({
    message: sanitizeApiError(response.status, response.statusText),
    detail,
    status: response.status,
    retryAfterMs:
      response.status === 429
        ? parseBitbucketRetryAfter(response.headers)
        : undefined,
  })
}

// ---------------------------------------------------------------------------
// Bitbucket rate limit header update
// ---------------------------------------------------------------------------

/**
 * Update the rate limit store from Bitbucket response headers.
 *
 * Bitbucket does not provide standard rate limit headers like GitHub/GitLab,
 * but we still call updateRateLimit for consistency in case any x-ratelimit-*
 * headers are returned (e.g., from Bitbucket Data Center).
 */
function updateBitbucketRateLimit(headers: Headers): void {
  updateRateLimit(headers)
}

// ---------------------------------------------------------------------------
// Auth header builder
// ---------------------------------------------------------------------------

/**
 * Build Bitbucket authentication headers.
 *
 * Bitbucket supports two auth mechanisms:
 * - `Authorization: Bearer <token>` for OAuth2 / Repository Access Tokens
 * - Basic Auth with app passwords (user:password) -- handled externally
 *
 * We use Bearer tokens since OAuth2 and repository access tokens are the
 * recommended authentication method for API v2.0.
 */
function buildAuthHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

// ---------------------------------------------------------------------------
// Core fetch helper
// ---------------------------------------------------------------------------

/**
 * Perform a raw Bitbucket API fetch.
 *
 * Returns the Response directly -- callers decide whether to parse JSON,
 * handle 204 No Content, etc.
 *
 * - Uses `Authorization: Bearer` header for authentication
 * - Updates rate limit store from response headers
 * - Returns BitbucketError on non-2xx responses
 * - Returns NetworkError when fetch itself fails
 */
export function bitbucketFetch(
  path: string,
  baseUrl: string,
  token: string,
  options?: RequestInit,
): Effect.Effect<Response, BitbucketError | NetworkError> {
  const url = buildBitbucketUrl(baseUrl, path)

  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...buildAuthHeaders(token),
          ...options?.headers,
        },
      })

      updateBitbucketRateLimit(response.headers)

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw mapBitbucketError(response, body)
      }

      touchLastUpdated()
      return response
    },
    catch: (error) => {
      if (error instanceof BitbucketError) return error
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
 * Fetch a Bitbucket API endpoint and parse the JSON response.
 *
 * Combines auth, error handling, and JSON parsing for the common case
 * of endpoints that return a JSON object or array.
 */
export function bitbucketFetchJson<T>(
  path: string,
  baseUrl: string,
  token: string,
  options?: RequestInit,
): Effect.Effect<T, BitbucketError | NetworkError> {
  const url = buildBitbucketUrl(baseUrl, path)

  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...buildAuthHeaders(token),
          ...options?.headers,
        },
      })

      updateBitbucketRateLimit(response.headers)

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw mapBitbucketError(response, body)
      }

      touchLastUpdated()
      const data = await response.json()
      return data as T
    },
    catch: (error) => {
      if (error instanceof BitbucketError) return error
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
 * Bitbucket API v2.0 paginated response shape.
 *
 * Bitbucket uses body-based pagination with the following structure:
 * - `values` -- array of items for the current page
 * - `page` -- current page number
 * - `size` -- total number of items (may be omitted)
 * - `pagelen` -- number of items per page
 * - `next` -- full URL for the next page (absent if no more pages)
 * - `previous` -- full URL for the previous page (absent if on first page)
 */
interface BitbucketPaginatedResponse<T> {
  readonly values: readonly T[]
  readonly page?: number
  readonly size?: number
  readonly pagelen?: number
  readonly next?: string
  readonly previous?: string
}

/**
 * Fetch all pages of a paginated Bitbucket REST API endpoint.
 *
 * Bitbucket uses body-based pagination: each response contains a `values`
 * array with the items, and a `next` URL to fetch the next page.
 * When `next` is absent, there are no more pages.
 *
 * Fetches up to MAX_PAGES pages (20) to prevent runaway pagination.
 * Items are concatenated across all pages.
 */
export function bitbucketFetchAllPages<T>(
  path: string,
  baseUrl: string,
  token: string,
  params?: Record<string, string>,
): Effect.Effect<T[], BitbucketError | NetworkError> {
  return Effect.tryPromise({
    try: async () => {
      const allItems: T[] = []
      let pageCount = 0

      const baseParams: Record<string, string> = {
        pagelen: '100',
        ...params,
      }

      let url = buildBitbucketUrl(baseUrl, path, baseParams)

      while (pageCount < MAX_PAGES) {
        pageCount++

        const response = await fetch(url, {
          headers: buildAuthHeaders(token),
        })

        updateBitbucketRateLimit(response.headers)

        if (!response.ok) {
          const body = await response.text().catch(() => '')
          throw mapBitbucketError(response, body)
        }

        const data = (await response.json()) as BitbucketPaginatedResponse<T>
        const items = data.values ?? []
        allItems.push(...items)

        // Bitbucket includes a `next` URL when more pages exist
        if (!data.next) {
          break
        }

        url = data.next
      }

      touchLastUpdated()
      return allItems
    },
    catch: (error) => {
      if (error instanceof BitbucketError) return error
      return new NetworkError({
        message: `Network request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        cause: error,
      })
    },
  })
}
