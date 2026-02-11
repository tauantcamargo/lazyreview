import { describe, it, expect } from 'vitest'
import { touchLastUpdated } from './useLastUpdated'

describe('lastUpdated store', () => {
  it('touchLastUpdated does not throw', () => {
    expect(() => touchLastUpdated()).not.toThrow()
  })
})
