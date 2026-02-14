import { Effect } from 'effect'
import { BitbucketError, NetworkError } from '../../models/errors'
import { sanitizeApiError } from '../../utils/sanitize'
import { updateRateLimit } from '../../hooks/useRateLimit'
import { touchLastUpdated } from '../../hooks/useLastUpdated'
import { notifyTokenExpired } from '../../hooks/useTokenExpired'

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

function buildBitbucketError(
  response: Response,
  body: string,
  url: string,
): BitbucketError {
  if (response.status === 401) {
    notifyTokenExpired()
  }

  let detail: string = body
  try {
    const parsed = JSON.parse(body)
    if (typeof parsed === 'object' && parsed !== null) {
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
    url,
    retryAfterMs:
      response.status === 429
        ? parseRetryAfter(response.headers)
        : undefined,
  })
}

/**
 * Parse Bitbucket's Retry-After header (seconds -> milliseconds).
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
// Auth headers
// ---------------------------------------------------------------------------

function bitbucketHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

/**
 * Execute a Bitbucket API mutation (POST/PUT/DELETE) that returns no data.
 */
export function mutateBitbucket(
  method: 'POST' | 'PUT' | 'DELETE',
  baseUrl: string,
  path: string,
  token: string,
  body?: Record<string, unknown>,
): Effect.Effect<void, BitbucketError | NetworkError> {
  const url = `${baseUrl}${path}`

  return Effect.tryPromise({
    try: async () => {
      const options: RequestInit = {
        method,
        headers: bitbucketHeaders(token),
      }

      if (body !== undefined) {
        options.body = JSON.stringify(body)
      }

      const response = await fetch(url, options)

      updateRateLimit(response.headers)

      if (!response.ok) {
        const responseBody = await response.text().catch(() => '')
        throw buildBitbucketError(response, responseBody, url)
      }

      touchLastUpdated()
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

/**
 * Execute a Bitbucket API mutation that returns JSON data.
 */
export function mutateBitbucketJson<T>(
  method: 'POST' | 'PUT' | 'DELETE',
  baseUrl: string,
  path: string,
  token: string,
  body: Record<string, unknown>,
): Effect.Effect<T, BitbucketError | NetworkError> {
  const url = `${baseUrl}${path}`

  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        method,
        headers: bitbucketHeaders(token),
        body: JSON.stringify(body),
      })

      updateRateLimit(response.headers)

      if (!response.ok) {
        const responseBody = await response.text().catch(() => '')
        throw buildBitbucketError(response, responseBody, url)
      }

      touchLastUpdated()
      const data = await response.json()
      if (data == null || typeof data !== 'object') {
        throw new BitbucketError({
          message: 'Unexpected API response: expected JSON object',
          status: response.status,
          url,
        })
      }
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

/**
 * Execute a Bitbucket API GET that returns JSON data.
 */
export function fetchBitbucket<T>(
  baseUrl: string,
  path: string,
  token: string,
): Effect.Effect<T, BitbucketError | NetworkError> {
  const url = `${baseUrl}${path}`

  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      updateRateLimit(response.headers)

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw buildBitbucketError(response, body, url)
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
