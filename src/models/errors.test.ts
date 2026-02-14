import { describe, it, expect } from 'vitest'
import { GitHubError, AuthError, ConfigError, NetworkError, StreamError, TimelineError } from './errors'

describe('GitHubError', () => {
  it('creates instance with message', () => {
    const error = new GitHubError({ message: 'Not found' })
    expect(error.message).toBe('Not found')
    expect(error._tag).toBe('GitHubError')
  })

  it('creates instance with status and url', () => {
    const error = new GitHubError({ message: 'Forbidden', status: 403, url: '/repos' })
    expect(error.status).toBe(403)
    expect(error.url).toBe('/repos')
  })
})

describe('AuthError', () => {
  it('creates instance with reason', () => {
    const error = new AuthError({ message: 'No token', reason: 'no_token' })
    expect(error.message).toBe('No token')
    expect(error.reason).toBe('no_token')
    expect(error._tag).toBe('AuthError')
  })

  it('supports all reason types', () => {
    const reasons = ['no_token', 'invalid_token', 'expired_token', 'save_failed'] as const
    for (const reason of reasons) {
      const error = new AuthError({ message: 'test', reason })
      expect(error.reason).toBe(reason)
    }
  })
})

describe('ConfigError', () => {
  it('creates instance with message', () => {
    const error = new ConfigError({ message: 'Bad config' })
    expect(error.message).toBe('Bad config')
    expect(error._tag).toBe('ConfigError')
  })

  it('includes optional path', () => {
    const error = new ConfigError({ message: 'Bad', path: '/foo/bar' })
    expect(error.path).toBe('/foo/bar')
  })
})

describe('NetworkError', () => {
  it('creates instance with message', () => {
    const error = new NetworkError({ message: 'Timeout' })
    expect(error.message).toBe('Timeout')
    expect(error._tag).toBe('NetworkError')
  })

  it('includes optional cause', () => {
    const cause = new Error('ECONNREFUSED')
    const error = new NetworkError({ message: 'Failed', cause })
    expect(error.cause).toBe(cause)
  })
})

describe('StreamError', () => {
  it('creates instance with message', () => {
    const error = new StreamError({ message: 'Stream interrupted' })
    expect(error.message).toBe('Stream interrupted')
    expect(error._tag).toBe('StreamError')
  })

  it('includes optional detail and cause', () => {
    const cause = new Error('connection reset')
    const error = new StreamError({
      message: 'Stream failed',
      detail: 'Connection was reset by peer',
      cause,
    })
    expect(error.detail).toBe('Connection was reset by peer')
    expect(error.cause).toBe(cause)
  })
})

describe('TimelineError', () => {
  it('creates instance with message', () => {
    const error = new TimelineError({ message: 'Timeline unavailable' })
    expect(error.message).toBe('Timeline unavailable')
    expect(error._tag).toBe('TimelineError')
  })

  it('includes optional detail and status', () => {
    const error = new TimelineError({
      message: 'Timeline fetch failed',
      detail: 'API returned 503',
      status: 503,
    })
    expect(error.detail).toBe('API returned 503')
    expect(error.status).toBe(503)
  })
})
