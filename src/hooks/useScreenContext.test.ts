import { describe, it, expect, beforeEach } from 'vitest'
import { setScreenContext } from './useScreenContext'

// We test the store's exported setter since the hook requires React
// The getSnapshot is tested indirectly via integration

describe('setScreenContext', () => {
  beforeEach(() => {
    // Reset to undefined
    setScreenContext(undefined)
  })

  it('does not throw when setting a valid context', () => {
    expect(() => setScreenContext('pr-list')).not.toThrow()
  })

  it('does not throw when setting undefined', () => {
    expect(() => setScreenContext(undefined)).not.toThrow()
  })

  it('accepts all valid screen contexts', () => {
    const contexts = [
      'pr-list',
      'pr-detail-files',
      'pr-detail-conversations',
      'pr-detail-commits',
      'settings',
    ] as const

    for (const ctx of contexts) {
      expect(() => setScreenContext(ctx)).not.toThrow()
    }
  })
})
