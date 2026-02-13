import { GitHubError, NetworkError } from '../models/errors'

const MAX_RETRIES = 3

/**
 * Determine whether a failed query should be retried.
 * - NetworkError: always retry (transient network issue)
 * - GitHubError 429: retry (rate limited, uses Retry-After delay)
 * - GitHubError 4xx (other): do NOT retry (client error)
 * - GitHubError 5xx: retry (server error)
 * - Unknown errors: retry (conservative)
 */
export function shouldRetryQuery(
  failureCount: number,
  error: unknown,
): boolean {
  if (failureCount >= MAX_RETRIES) return false

  if (error instanceof NetworkError) return true
  if (error instanceof GitHubError) {
    const status = error.status
    if (!status) return true
    if (status === 429) return true
    if (status >= 400 && status < 500) return false
    return true // 5xx
  }

  return true
}

/**
 * Calculate retry delay with exponential backoff.
 * Base delays: 1s, 2s, 4s.
 * For 429 responses, use Retry-After header if available.
 */
export function getRetryDelay(failureCount: number, error: unknown): number {
  // For 429 with Retry-After, use the server-specified delay
  if (
    error instanceof GitHubError &&
    error.status === 429 &&
    error.retryAfterMs
  ) {
    return error.retryAfterMs
  }

  // Exponential backoff: 1s, 2s, 4s
  return Math.min(1000 * Math.pow(2, failureCount), 4000)
}
