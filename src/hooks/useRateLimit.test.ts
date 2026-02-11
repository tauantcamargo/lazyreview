import { describe, it, expect } from 'vitest'
import { updateRateLimit, getRateLimitRemaining } from './useRateLimit'

describe('rate limit store', () => {
  it('starts with default remaining of 5000', () => {
    expect(getRateLimitRemaining()).toBe(5000)
  })

  it('updates from response headers', () => {
    const headers = new Headers({
      'x-ratelimit-remaining': '4500',
      'x-ratelimit-limit': '5000',
      'x-ratelimit-reset': '1700000000',
    })

    updateRateLimit(headers)
    expect(getRateLimitRemaining()).toBe(4500)
  })

  it('ignores headers with missing rate limit data', () => {
    const before = getRateLimitRemaining()
    const headers = new Headers({ 'content-type': 'application/json' })
    updateRateLimit(headers)
    expect(getRateLimitRemaining()).toBe(before)
  })
})
