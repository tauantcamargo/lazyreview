import { describe, it, expect } from 'vitest'
import { useLoading } from './useLoading'

describe('useLoading', () => {
  it('returns empty loading state', () => {
    const state = useLoading()
    expect(state.isLoading).toBe(false)
    expect(state.message).toBeNull()
  })
})
