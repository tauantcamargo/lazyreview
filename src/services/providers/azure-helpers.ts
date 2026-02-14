import { Effect } from 'effect'
import { AzureError, NetworkError } from '../../models/errors'
import { sanitizeApiError } from '../../utils/sanitize'
import { updateRateLimit } from '../../hooks/useRateLimit'
import { touchLastUpdated } from '../../hooks/useLastUpdated'
import { notifyTokenExpired } from '../../hooks/useTokenExpired'

const API_VERSION = '7.0'

// ---------------------------------------------------------------------------
// Azure DevOps org/project parsing
// ---------------------------------------------------------------------------

/**
 * Parse Azure DevOps owner string (org/project) into org and project parts.
 * The owner field stores "org/project" for Azure DevOps.
 */
export function parseAzureOwner(owner: string): {
  readonly org: string
  readonly project: string
} {
  const separatorIndex = owner.indexOf('/')
  if (separatorIndex === -1) {
    return { org: owner, project: owner }
  }
  return {
    org: owner.slice(0, separatorIndex),
    project: owner.slice(separatorIndex + 1),
  }
}

// ---------------------------------------------------------------------------
// URL builder
// ---------------------------------------------------------------------------

function buildAzureUrl(
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
// Error handling
// ---------------------------------------------------------------------------

function buildAzureError(
  response: Response,
  body: string,
  url: string,
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
    url,
    retryAfterMs:
      response.status === 429
        ? parseRetryAfter(response.headers)
        : undefined,
  })
}

/**
 * Parse Azure DevOps Retry-After header (seconds -> milliseconds).
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

function azureHeaders(token: string): Record<string, string> {
  const encoded = Buffer.from(`:${token}`).toString('base64')
  return {
    Authorization: `Basic ${encoded}`,
    'Content-Type': 'application/json',
  }
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

/**
 * Execute an Azure DevOps API mutation (POST/PUT/PATCH/DELETE) that returns no data.
 */
export function mutateAzure(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  baseUrl: string,
  path: string,
  token: string,
  body?: Record<string, unknown>,
): Effect.Effect<void, AzureError | NetworkError> {
  const url = buildAzureUrl(baseUrl, path)

  return Effect.tryPromise({
    try: async () => {
      const options: RequestInit = {
        method,
        headers: azureHeaders(token),
      }

      if (body !== undefined) {
        options.body = JSON.stringify(body)
      }

      const response = await fetch(url, options)

      updateRateLimit(response.headers)

      if (!response.ok) {
        const responseBody = await response.text().catch(() => '')
        throw buildAzureError(response, responseBody, url)
      }

      touchLastUpdated()
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

/**
 * Execute an Azure DevOps API mutation that returns JSON data.
 */
export function mutateAzureJson<T>(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  baseUrl: string,
  path: string,
  token: string,
  body: Record<string, unknown>,
): Effect.Effect<T, AzureError | NetworkError> {
  const url = buildAzureUrl(baseUrl, path)

  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        method,
        headers: azureHeaders(token),
        body: JSON.stringify(body),
      })

      updateRateLimit(response.headers)

      if (!response.ok) {
        const responseBody = await response.text().catch(() => '')
        throw buildAzureError(response, responseBody, url)
      }

      touchLastUpdated()
      const data = await response.json()
      if (data == null || typeof data !== 'object') {
        throw new AzureError({
          message: 'Unexpected API response: expected JSON object',
          status: response.status,
          url,
        })
      }
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

/**
 * Execute an Azure DevOps API GET that returns JSON data.
 */
export function fetchAzure<T>(
  baseUrl: string,
  path: string,
  token: string,
  params?: Record<string, string>,
): Effect.Effect<T, AzureError | NetworkError> {
  const url = buildAzureUrl(baseUrl, path, params)

  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        headers: {
          Authorization: azureHeaders(token).Authorization,
        },
      })

      updateRateLimit(response.headers)

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw buildAzureError(response, body, url)
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
