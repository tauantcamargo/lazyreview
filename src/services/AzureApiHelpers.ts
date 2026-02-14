import { Effect } from 'effect'
import { AzureError, NetworkError } from '../models/errors'
import { updateRateLimit } from '../hooks/useRateLimit'
import { touchLastUpdated } from '../hooks/useLastUpdated'
import { sanitizeApiError } from '../utils/sanitize'
import { notifyTokenExpired } from '../hooks/useTokenExpired'

const MAX_PAGES = 20
const API_VERSION = '7.0'

// ---------------------------------------------------------------------------
// URL builder
// ---------------------------------------------------------------------------

/**
 * Build a full Azure DevOps API URL from base URL, path, and optional params.
 *
 * Azure DevOps requires `api-version` as a query parameter on all requests.
 * The path should start with `/{org}/{project}/...`
 */
export function buildAzureUrl(
  baseUrl: string,
  path: string,
  params?: Record<string, string>,
): string {
  const allParams: Record<string, string> = {
    'api-version': API_VERSION,
    ...params,
  }

  const searchParams = new URLSearchParams(allParams)
  return `${baseUrl}${path}?${searchParams.toString()}`
}

// ---------------------------------------------------------------------------
// Retry-After parsing
// ---------------------------------------------------------------------------

/**
 * Parse Azure DevOps rate limit retry-after information.
 *
 * Azure DevOps uses `Retry-After` header (seconds) when rate-limited (429).
 */
export function parseAzureRetryAfter(headers: Headers): number | undefined {
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
 * Map an Azure DevOps API error response to an AzureError.
 *
 * Azure DevOps returns errors in formats like:
 * - `{ message: string, typeKey: string }`
 * - `{ $id: string, message: string }`
 * - `{ value: { Message: string } }`
 */
export function mapAzureError(
  response: Response,
  body: string,
): AzureError {
  if (response.status === 401 || response.status === 203) {
    notifyTokenExpired()
  }

  let detail: string = body
  try {
    const parsed = JSON.parse(body)
    if (typeof parsed === 'object' && parsed !== null) {
      detail =
        parsed.message ??
        parsed.Message ??
        parsed.value?.Message ??
        body
    }
  } catch {
    // body is not JSON, use as-is
  }

  return new AzureError({
    message: sanitizeApiError(response.status, response.statusText),
    detail,
    status: response.status,
    retryAfterMs:
      response.status === 429
        ? parseAzureRetryAfter(response.headers)
        : undefined,
  })
}

// ---------------------------------------------------------------------------
// Auth header builder
// ---------------------------------------------------------------------------

/**
 * Build Azure DevOps authentication headers.
 *
 * Azure DevOps uses Basic auth with PAT:
 * - Username is empty, password is the PAT
 * - Header: `Authorization: Basic base64(:PAT)`
 */
function buildAuthHeaders(token: string): Record<string, string> {
  const encoded = Buffer.from(`:${token}`).toString('base64')
  return {
    Authorization: `Basic ${encoded}`,
    'Content-Type': 'application/json',
  }
}

// ---------------------------------------------------------------------------
// Rate limit update
// ---------------------------------------------------------------------------

function updateAzureRateLimit(headers: Headers): void {
  updateRateLimit(headers)
}

// ---------------------------------------------------------------------------
// Core fetch helper
// ---------------------------------------------------------------------------

/**
 * Perform a raw Azure DevOps API fetch.
 */
export function azureFetch(
  path: string,
  baseUrl: string,
  token: string,
  options?: RequestInit,
): Effect.Effect<Response, AzureError | NetworkError> {
  const url = buildAzureUrl(baseUrl, path)

  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...buildAuthHeaders(token),
          ...options?.headers,
        },
      })

      updateAzureRateLimit(response.headers)

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw mapAzureError(response, body)
      }

      touchLastUpdated()
      return response
    },
    catch: (error) => {
      if (error instanceof AzureError) return error
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
 * Fetch an Azure DevOps API endpoint and parse the JSON response.
 */
export function azureFetchJson<T>(
  path: string,
  baseUrl: string,
  token: string,
  params?: Record<string, string>,
): Effect.Effect<T, AzureError | NetworkError> {
  const url = buildAzureUrl(baseUrl, path, params)

  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        headers: buildAuthHeaders(token),
      })

      updateAzureRateLimit(response.headers)

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw mapAzureError(response, body)
      }

      touchLastUpdated()
      const data = await response.json()
      return data as T
    },
    catch: (error) => {
      if (error instanceof AzureError) return error
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
 * Azure DevOps paginated response shape.
 *
 * Azure uses `value` array with `$top` and `$skip` for pagination.
 * A `continuationToken` in the response headers indicates more pages.
 */
interface AzurePaginatedResponse<T> {
  readonly value: readonly T[]
  readonly count?: number
}

/**
 * Fetch all pages of a paginated Azure DevOps API endpoint.
 *
 * Uses `$top` / `$skip` with the `x-ms-continuationtoken` header
 * to fetch additional pages.
 */
export function azureFetchAllPages<T>(
  path: string,
  baseUrl: string,
  token: string,
  params?: Record<string, string>,
): Effect.Effect<T[], AzureError | NetworkError> {
  return Effect.tryPromise({
    try: async () => {
      const allItems: T[] = []
      let pageCount = 0
      let skip = 0
      const top = 100

      const baseParams: Record<string, string> = {
        ...params,
      }

      let continuationToken: string | null = null

      while (pageCount < MAX_PAGES) {
        pageCount++

        const pageParams: Record<string, string> = {
          ...baseParams,
          $top: String(top),
        }

        if (continuationToken) {
          pageParams.continuationToken = continuationToken
        } else if (skip > 0) {
          pageParams.$skip = String(skip)
        }

        const url = buildAzureUrl(baseUrl, path, pageParams)

        const response = await fetch(url, {
          headers: buildAuthHeaders(token),
        })

        updateAzureRateLimit(response.headers)

        if (!response.ok) {
          const body = await response.text().catch(() => '')
          throw mapAzureError(response, body)
        }

        const data = (await response.json()) as AzurePaginatedResponse<T>
        const items = data.value ?? []
        allItems.push(...items)

        // Check for continuation token
        const nextToken = response.headers.get('x-ms-continuationtoken')
        if (nextToken) {
          continuationToken = nextToken
        } else if (items.length >= top) {
          // No continuation token but full page, try skip-based pagination
          skip += items.length
          continuationToken = null
        } else {
          break
        }
      }

      touchLastUpdated()
      return allItems
    },
    catch: (error) => {
      if (error instanceof AzureError) return error
      return new NetworkError({
        message: `Network request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        cause: error,
      })
    },
  })
}
