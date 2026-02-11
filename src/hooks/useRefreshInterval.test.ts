import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUseConfig = vi.fn()
const mockUseRateLimit = vi.fn()

vi.mock('./useConfig', () => ({
  useConfig: () => mockUseConfig(),
}))

vi.mock('./useRateLimit', () => ({
  useRateLimit: () => mockUseRateLimit(),
}))

import { useRefreshInterval } from './useRefreshInterval'

describe('useRefreshInterval', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseConfig.mockReturnValue({ config: { refreshInterval: 60 } })
    mockUseRateLimit.mockReturnValue({ remaining: 5000 })
  })

  it('returns config refreshInterval in milliseconds by default', () => {
    const interval = useRefreshInterval()
    expect(interval).toBe(60_000)
  })

  it('uses override when provided', () => {
    const interval = useRefreshInterval(30)
    expect(interval).toBe(30_000)
  })

  it('falls back to 60 seconds when config has no refreshInterval', () => {
    mockUseConfig.mockReturnValue({ config: null })
    const interval = useRefreshInterval()
    expect(interval).toBe(60_000)
  })

  it('returns slow interval (5min) when rate limit is low', () => {
    mockUseRateLimit.mockReturnValue({ remaining: 50 })
    const interval = useRefreshInterval()
    expect(interval).toBe(5 * 60 * 1000)
  })

  it('returns slow interval at exactly the threshold boundary', () => {
    mockUseRateLimit.mockReturnValue({ remaining: 99 })
    const interval = useRefreshInterval()
    expect(interval).toBe(5 * 60 * 1000)
  })

  it('returns normal interval at exactly the threshold', () => {
    mockUseRateLimit.mockReturnValue({ remaining: 100 })
    const interval = useRefreshInterval()
    expect(interval).toBe(60_000)
  })

  it('uses override even when rate limit is sufficient', () => {
    mockUseRateLimit.mockReturnValue({ remaining: 4000 })
    const interval = useRefreshInterval(120)
    expect(interval).toBe(120_000)
  })

  it('uses slow interval even with override when rate limit is low', () => {
    mockUseRateLimit.mockReturnValue({ remaining: 10 })
    const interval = useRefreshInterval(15)
    expect(interval).toBe(5 * 60 * 1000) // slow interval overrides
  })
})
