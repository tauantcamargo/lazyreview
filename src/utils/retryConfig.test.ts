import { describe, it, expect } from 'vitest'
import { shouldRetryQuery, getRetryDelay } from './retryConfig'
import { GitHubError, NetworkError } from '../models/errors'

describe('shouldRetryQuery', () => {
  it('retries NetworkError up to 3 times', () => {
    const error = new NetworkError({ message: 'Connection refused' })
    expect(shouldRetryQuery(0, error)).toBe(true)
    expect(shouldRetryQuery(1, error)).toBe(true)
    expect(shouldRetryQuery(2, error)).toBe(true)
    expect(shouldRetryQuery(3, error)).toBe(false)
  })

  it('retries GitHubError 429 (rate limited)', () => {
    const error = new GitHubError({
      message: 'Rate limit exceeded',
      status: 429,
    })
    expect(shouldRetryQuery(0, error)).toBe(true)
    expect(shouldRetryQuery(1, error)).toBe(true)
    expect(shouldRetryQuery(2, error)).toBe(true)
  })

  it('does NOT retry GitHubError 400', () => {
    const error = new GitHubError({
      message: 'Bad request',
      status: 400,
    })
    expect(shouldRetryQuery(0, error)).toBe(false)
  })

  it('does NOT retry GitHubError 401', () => {
    const error = new GitHubError({
      message: 'Unauthorized',
      status: 401,
    })
    expect(shouldRetryQuery(0, error)).toBe(false)
  })

  it('does NOT retry GitHubError 403', () => {
    const error = new GitHubError({
      message: 'Forbidden',
      status: 403,
    })
    expect(shouldRetryQuery(0, error)).toBe(false)
  })

  it('does NOT retry GitHubError 404', () => {
    const error = new GitHubError({
      message: 'Not found',
      status: 404,
    })
    expect(shouldRetryQuery(0, error)).toBe(false)
  })

  it('does NOT retry GitHubError 422', () => {
    const error = new GitHubError({
      message: 'Validation failed',
      status: 422,
    })
    expect(shouldRetryQuery(0, error)).toBe(false)
  })

  it('retries GitHubError 500 (server error)', () => {
    const error = new GitHubError({
      message: 'Internal server error',
      status: 500,
    })
    expect(shouldRetryQuery(0, error)).toBe(true)
  })

  it('retries GitHubError 502', () => {
    const error = new GitHubError({
      message: 'Bad gateway',
      status: 502,
    })
    expect(shouldRetryQuery(0, error)).toBe(true)
  })

  it('retries GitHubError 503', () => {
    const error = new GitHubError({
      message: 'Service unavailable',
      status: 503,
    })
    expect(shouldRetryQuery(0, error)).toBe(true)
  })

  it('retries GitHubError without status', () => {
    const error = new GitHubError({ message: 'Unknown error' })
    expect(shouldRetryQuery(0, error)).toBe(true)
  })

  it('retries unknown errors', () => {
    const error = new Error('Something went wrong')
    expect(shouldRetryQuery(0, error)).toBe(true)
  })

  it('stops retrying after 3 failures for any error', () => {
    const error = new NetworkError({ message: 'Connection refused' })
    expect(shouldRetryQuery(3, error)).toBe(false)
  })
})

describe('getRetryDelay', () => {
  it('returns 1s for first retry', () => {
    const error = new NetworkError({ message: 'fail' })
    expect(getRetryDelay(0, error)).toBe(1000)
  })

  it('returns 2s for second retry', () => {
    const error = new NetworkError({ message: 'fail' })
    expect(getRetryDelay(1, error)).toBe(2000)
  })

  it('returns 4s for third retry', () => {
    const error = new NetworkError({ message: 'fail' })
    expect(getRetryDelay(2, error)).toBe(4000)
  })

  it('caps at 4s for higher failure counts', () => {
    const error = new NetworkError({ message: 'fail' })
    expect(getRetryDelay(5, error)).toBe(4000)
  })

  it('uses Retry-After for 429 responses', () => {
    const error = new GitHubError({
      message: 'Rate limit exceeded',
      status: 429,
      retryAfterMs: 30000,
    })
    expect(getRetryDelay(0, error)).toBe(30000)
  })

  it('falls back to exponential backoff for 429 without Retry-After', () => {
    const error = new GitHubError({
      message: 'Rate limit exceeded',
      status: 429,
    })
    expect(getRetryDelay(0, error)).toBe(1000)
  })

  it('uses exponential backoff for non-429 GitHubError', () => {
    const error = new GitHubError({
      message: 'Server error',
      status: 500,
    })
    expect(getRetryDelay(1, error)).toBe(2000)
  })
})
