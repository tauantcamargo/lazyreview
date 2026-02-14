import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildGiteaUrl, parseGiteaRetryAfter, mapGiteaError } from './GiteaApiHelpers'

// Mock dependencies that the module imports
vi.mock('../hooks/useRateLimit', () => ({
  updateRateLimit: vi.fn(),
}))
vi.mock('../hooks/useLastUpdated', () => ({
  touchLastUpdated: vi.fn(),
}))
vi.mock('../hooks/useTokenExpired', () => ({
  notifyTokenExpired: vi.fn(),
}))

// ---------------------------------------------------------------------------
// buildGiteaUrl
// ---------------------------------------------------------------------------

describe('buildGiteaUrl', () => {
  it('builds a URL without params', () => {
    const url = buildGiteaUrl('https://gitea.example.com/api/v1', '/repos/owner/repo/pulls')
    expect(url).toBe('https://gitea.example.com/api/v1/repos/owner/repo/pulls')
  })

  it('builds a URL with params', () => {
    const url = buildGiteaUrl(
      'https://gitea.example.com/api/v1',
      '/repos/owner/repo/pulls',
      { state: 'open', limit: '30' },
    )
    expect(url).toContain('state=open')
    expect(url).toContain('limit=30')
  })

  it('returns base URL when params is empty object', () => {
    const url = buildGiteaUrl('https://gitea.example.com/api/v1', '/user', {})
    expect(url).toBe('https://gitea.example.com/api/v1/user')
  })

  it('returns base URL when params is undefined', () => {
    const url = buildGiteaUrl('https://gitea.example.com/api/v1', '/user')
    expect(url).toBe('https://gitea.example.com/api/v1/user')
  })
})

// ---------------------------------------------------------------------------
// parseGiteaRetryAfter
// ---------------------------------------------------------------------------

describe('parseGiteaRetryAfter', () => {
  it('returns milliseconds from seconds header', () => {
    const headers = new Headers({ 'Retry-After': '60' })
    expect(parseGiteaRetryAfter(headers)).toBe(60000)
  })

  it('returns undefined when no Retry-After header', () => {
    const headers = new Headers()
    expect(parseGiteaRetryAfter(headers)).toBeUndefined()
  })

  it('returns undefined for non-numeric values', () => {
    const headers = new Headers({ 'Retry-After': 'abc' })
    expect(parseGiteaRetryAfter(headers)).toBeUndefined()
  })

  it('returns undefined for zero', () => {
    const headers = new Headers({ 'Retry-After': '0' })
    expect(parseGiteaRetryAfter(headers)).toBeUndefined()
  })

  it('returns undefined for negative values', () => {
    const headers = new Headers({ 'Retry-After': '-5' })
    expect(parseGiteaRetryAfter(headers)).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// mapGiteaError
// ---------------------------------------------------------------------------

describe('mapGiteaError', () => {
  it('extracts message from JSON response', () => {
    const response = new Response('', { status: 404, statusText: 'Not Found' })
    const body = JSON.stringify({ message: 'repo not found' })
    const error = mapGiteaError(response, body, 'https://gitea.example.com/api/v1/repos/owner/repo')

    expect(error.message).toBe('Resource not found')
    expect(error.detail).toBe('repo not found')
    expect(error.status).toBe(404)
    expect(error.url).toBe('https://gitea.example.com/api/v1/repos/owner/repo')
  })

  it('uses raw body for non-JSON responses', () => {
    const response = new Response('', { status: 500, statusText: 'Internal Server Error' })
    const body = 'something went wrong'
    const error = mapGiteaError(response, body)

    expect(error.message).toBe('Internal server error')
    expect(error.detail).toBe('something went wrong')
    expect(error.status).toBe(500)
  })

  it('includes retryAfterMs for 429 responses', () => {
    const headers = new Headers({ 'Retry-After': '120' })
    const response = new Response('', {
      status: 429,
      statusText: 'Too Many Requests',
      headers,
    })
    const error = mapGiteaError(response, '{}')

    expect(error.status).toBe(429)
    expect(error.retryAfterMs).toBe(120000)
  })

  it('handles 401 responses', () => {
    const response = new Response('', { status: 401, statusText: 'Unauthorized' })
    const error = mapGiteaError(response, '{}')

    expect(error.message).toBe('Authentication failed')
    expect(error.status).toBe(401)
  })

  it('handles 403 responses', () => {
    const response = new Response('', { status: 403, statusText: 'Forbidden' })
    const error = mapGiteaError(response, JSON.stringify({ message: 'access denied' }))

    expect(error.message).toBe('Permission denied')
    expect(error.detail).toBe('access denied')
  })
})
